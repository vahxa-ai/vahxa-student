"""Unit quizzes (instant feedback) and subject tests (graded on submit).

Questions are drawn from each unit's shared multiple-choice bank, shuffled per attempt, and snapshotted on the
attempt. Correct answers stay on the server until revealed: per question for quizzes, on submit for tests."""
import json
import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_approved_student
from app.api.routes.curriculum import ensure_quiz_banks
from app.api.routes.subjects import own_subject
from app.db.database import get_db
from app.models.models import CurriculumUnit, QuizAttempt, Student
from app.schemas.schemas import (
    QuizStartRequest, AttemptOut, AttemptQuestionOut, AnswerRequest, SubmitRequest, AttemptSummaryOut,
)

router = APIRouter(tags=["quizzes"])

QUIZ_LENGTH = 10
_LATE_GRACE = timedelta(seconds=30)   # network slack before a timed test counts as over time


# ─── helpers ──────────────────────────────────────────────────────────────────

def _shuffled_question(q: dict, unit: CurriculumUnit, rng: random.Random) -> dict:
    order = list(range(len(q["options"])))
    rng.shuffle(order)
    return {
        "question": q["question"],
        "options": [q["options"][i] for i in order],
        "answer": order.index(q["answer"]),
        "explanation": q.get("explanation", ""),
        "difficulty": q.get("difficulty", "medium"),
        "unit_id": unit.id,
        "unit_title": unit.title,
    }


def _pick_questions(units: list[CurriculumUnit], count: int, rng: random.Random) -> list[dict]:
    """Spread `count` questions as evenly as possible across the units, random within each unit."""
    pools = []
    for unit in units:
        bank = json.loads(unit.quiz_json or "[]")
        rng.shuffle(bank)
        pools.append((unit, bank))
    picked: list[dict] = []
    while len(picked) < count and any(bank for _, bank in pools):
        for unit, bank in pools:
            if bank and len(picked) < count:
                picked.append(_shuffled_question(bank.pop(), unit, rng))
    rng.shuffle(picked)
    return picked


def _expires_at(a: QuizAttempt) -> Optional[datetime]:
    return a.started_at + timedelta(minutes=a.time_limit_minutes) if a.time_limit_minutes else None


def _attempt_out(a: QuizAttempt) -> AttemptOut:
    questions, answers = json.loads(a.questions_json), json.loads(a.answers_json)
    done = a.submitted_at is not None
    out = []
    for i, (q, ans) in enumerate(zip(questions, answers)):
        revealed = done or (a.kind == "quiz" and ans is not None)
        out.append(AttemptQuestionOut(
            index=i, question=q["question"], options=q["options"], difficulty=q["difficulty"],
            unit_title=q["unit_title"],
            your_answer=ans if (revealed or a.kind == "test") else None,
            correct_answer=q["answer"] if revealed else None,
            correct=(ans == q["answer"]) if revealed else None,
            explanation=q["explanation"] if revealed else None,
        ))
    return AttemptOut(
        id=a.id, subject_id=a.subject_id, kind=a.kind, unit_ids=json.loads(a.unit_ids_json), total=a.total,
        score=a.score, time_limit_minutes=a.time_limit_minutes, started_at=a.started_at,
        expires_at=_expires_at(a), submitted_at=a.submitted_at, timed_out=a.timed_out, questions=out,
    )


async def _own_attempt(attempt_id: int, student: Student, db: AsyncSession) -> QuizAttempt:
    a = await db.get(QuizAttempt, attempt_id)
    if not a or a.student_id != student.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return a


# ─── routes ───────────────────────────────────────────────────────────────────

@router.post("/subjects/{subject_id}/attempts", response_model=AttemptOut)
async def start_attempt(subject_id: int, payload: QuizStartRequest,
                        student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    subject = await own_subject(subject_id, student, db)
    all_units = list((await db.execute(
        select(CurriculumUnit).where(CurriculumUnit.subject_id == subject.id).order_by(CurriculumUnit.position)
    )).scalars().all())
    if not all_units:
        raise HTTPException(status_code=409, detail="Load this subject's curriculum first.")
    by_id = {u.id: u for u in all_units}

    if payload.kind == "quiz":
        if payload.unit_id not in by_id:
            raise HTTPException(status_code=404, detail="Unit not found")
        units, count, time_limit = [by_id[payload.unit_id]], QUIZ_LENGTH, None
    else:
        ids = payload.unit_ids or list(by_id)
        if not ids or any(i not in by_id for i in ids):
            raise HTTPException(status_code=404, detail="Unit not found")
        units = [by_id[i] for i in dict.fromkeys(ids)]
        count, time_limit = payload.count, payload.time_limit_minutes

    await ensure_quiz_banks(student, subject, units, db)
    questions = _pick_questions(units, count, random.Random())
    if not questions:
        raise HTTPException(status_code=502, detail="No questions available. Please try again.")

    attempt = QuizAttempt(
        student_id=student.id, subject_id=subject.id, kind=payload.kind,
        unit_ids_json=json.dumps([u.id for u in units]), questions_json=json.dumps(questions),
        answers_json=json.dumps([None] * len(questions)), total=len(questions),
        time_limit_minutes=time_limit, started_at=datetime.utcnow(),
    )
    db.add(attempt)
    await db.flush()
    return _attempt_out(attempt)


@router.get("/attempts/{attempt_id}", response_model=AttemptOut)
async def get_attempt(attempt_id: int, student: Student = Depends(get_approved_student),
                      db: AsyncSession = Depends(get_db)):
    return _attempt_out(await _own_attempt(attempt_id, student, db))


@router.post("/attempts/{attempt_id}/answer", response_model=AttemptQuestionOut)
async def answer_question(attempt_id: int, payload: AnswerRequest,
                          student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    """Quizzes only: lock in one answer and get instant feedback."""
    a = await _own_attempt(attempt_id, student, db)
    if a.kind != "quiz":
        raise HTTPException(status_code=409, detail="Test answers are submitted together at the end.")
    if a.submitted_at:
        raise HTTPException(status_code=409, detail="This quiz is already finished.")
    answers = json.loads(a.answers_json)
    if payload.index >= len(answers):
        raise HTTPException(status_code=404, detail="Question not found")
    if answers[payload.index] is not None:
        raise HTTPException(status_code=409, detail="You've already answered this question.")
    answers[payload.index] = payload.choice
    a.answers_json = json.dumps(answers)
    await db.flush()
    return _attempt_out(a).questions[payload.index]


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptOut)
async def submit_attempt(attempt_id: int, payload: SubmitRequest = SubmitRequest(),
                         student: Student = Depends(get_approved_student), db: AsyncSession = Depends(get_db)):
    a = await _own_attempt(attempt_id, student, db)
    if a.submitted_at:
        return _attempt_out(a)
    questions, answers = json.loads(a.questions_json), json.loads(a.answers_json)
    if a.kind == "test":
        given = payload.answers or []
        if len(given) > len(questions) or any(c is not None and not 0 <= c <= 3 for c in given):
            raise HTTPException(status_code=400, detail="Invalid answers.")
        answers = given + [None] * (len(questions) - len(given))
    now = datetime.utcnow()
    expires = _expires_at(a)
    a.timed_out = bool(expires and now > expires + _LATE_GRACE)
    a.answers_json = json.dumps(answers)
    a.score = sum(1 for q, ans in zip(questions, answers) if ans == q["answer"])
    a.submitted_at = now
    await db.flush()
    return _attempt_out(a)


@router.get("/subjects/{subject_id}/attempts", response_model=list[AttemptSummaryOut])
async def list_attempts(subject_id: int, student: Student = Depends(get_approved_student),
                        db: AsyncSession = Depends(get_db)):
    await own_subject(subject_id, student, db)
    titles = {u.id: u.title for u in (await db.execute(
        select(CurriculumUnit).where(CurriculumUnit.subject_id == subject_id))).scalars().all()}
    attempts = (await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.student_id == student.id, QuizAttempt.subject_id == subject_id,
               QuizAttempt.submitted_at.is_not(None))
        .order_by(QuizAttempt.submitted_at.desc())
        .limit(50)
    )).scalars().all()
    out = []
    for a in attempts:
        unit_ids = json.loads(a.unit_ids_json)
        out.append(AttemptSummaryOut(
            id=a.id, kind=a.kind, unit_ids=unit_ids, unit_titles=[titles.get(i, "(removed unit)") for i in unit_ids],
            score=a.score, total=a.total, percent=round(100 * a.score / a.total) if a.total and a.score is not None else None,
            started_at=a.started_at, submitted_at=a.submitted_at, timed_out=a.timed_out,
        ))
    return out
