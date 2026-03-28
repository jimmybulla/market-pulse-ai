# backend/app/services/push.py
import json
import logging

from pywebpush import webpush, WebPushException
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)


def send_push_notification(
    subscription: dict, title: str, body: str, url: str, db: Client
) -> None:
    """Send a single Web Push notification via VAPID.

    Deletes stale subscriptions (HTTP 410/404) from the DB automatically.
    All other errors are logged but do not propagate.
    """
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
        )
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code in (410, 404):
            db.table("push_subscriptions").delete().eq(
                "endpoint", subscription["endpoint"]
            ).execute()
        else:
            logger.error("[push] WebPush failed for %s: %s", subscription["endpoint"], exc)
    except Exception as exc:
        logger.error("[push] Unexpected push error for %s: %s", subscription["endpoint"], exc)
