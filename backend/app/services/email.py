"""
Outgoing email over SMTP (Gmail with an App Password in production).
If SMTP isn't configured, messages are logged instead so development still works.
Sending never raises — a failed email must not break sign-up; failures are logged.
"""
import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger(__name__)


def _configured() -> bool:
    return bool(settings.smtp_user and settings.smtp_password)


def _send_sync(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = f"Vahxa Student <{settings.email_from or settings.smtp_user}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> bool:
    if not _configured():
        log.warning("SMTP not configured — email to %s not sent.\nSubject: %s\n%s", to, subject, body)
        return False
    try:
        await asyncio.to_thread(_send_sync, to, subject, body)
        return True
    except Exception as e:  # never break the calling request
        log.error("Failed to send email to %s: %s", to, e)
        return False


# ─── Messages ─────────────────────────────────────────────────────────────────

def _link(path: str) -> str:
    return settings.app_base_url.rstrip("/") + path


async def send_consent_request(parent_email: str, parent_name: str, student_name: str, token: str) -> bool:
    return await send_email(
        parent_email,
        f"Parental consent needed for {student_name} to use Vahxa Student",
        f"""Hello {parent_name or ""},

{student_name} has signed up for Vahxa Student, a study planner that helps students organise
their subjects, deadlines and schedule, and uses AI to prepare curriculum notes and practice questions.

Because {student_name} is a minor, we need a parent or guardian's consent before they can use it.
Please review what we collect and give (or decline) consent here:

{_link(f"/consent/{token}")}

You'll be asked to sign in with the Google account for this email address ({parent_email}).
This link expires in {settings.consent_link_days} days.

If you don't know {student_name} or didn't expect this, you can ignore this email.

— Vahxa Student
""",
    )


async def notify_admins_pending(student_name: str, student_email: str) -> None:
    for admin in settings.admin_email_set:
        await send_email(
            admin,
            f"Vahxa Student: {student_name} is waiting for approval",
            f"""{student_name} ({student_email}) has parental consent and is waiting for approval.

Review sign-ups: {_link("/admin")}
""",
        )


async def notify_student_status(student_email: str, student_name: str, status: str, note: str | None = None) -> None:
    messages = {
        "approved": ("Your Vahxa Student account is ready",
                     f"Hi {student_name},\n\nYour account has been approved. Sign in to get started:\n{_link('/')}\n"),
        "rejected": ("Your Vahxa Student sign-up",
                     f"Hi {student_name},\n\nYour sign-up was not approved."
                     + (f"\n\nNote from the admin: {note}" if note else "") + "\n"),
        "suspended": ("Your Vahxa Student account has been paused",
                      f"Hi {student_name},\n\nYour account has been paused by an admin."
                      + (f"\n\nNote: {note}" if note else "") + "\n"),
        "consent_revoked": ("Parental consent was withdrawn",
                            f"Hi {student_name},\n\nYour parent or guardian withdrew consent, so your account is "
                            f"paused until consent is given again.\n{_link('/')}\n"),
    }
    if status in messages:
        subject, body = messages[status]
        await send_email(student_email, subject, body + "\n— Vahxa Student\n")
