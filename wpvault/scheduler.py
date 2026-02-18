import os
import glob
from datetime import datetime, timedelta
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

load_dotenv()

import watcher
import session_manager
import storage
import database
import notifier


def check_and_refresh_session():
    if not session_manager.is_session_valid():
        success = session_manager.login_and_save_session()
        if not success:
            notifier.notify_session_failed()


def cleanup_tmp():
    tmp_dir = os.getenv("TMP_DIR", "/tmp/downloads")
    cutoff = datetime.now() - timedelta(hours=24)
    if os.path.exists(tmp_dir):
        for f in glob.glob(f"{tmp_dir}/*.zip"):
            try:
                if os.path.getmtime(f) < cutoff.timestamp():
                    os.remove(f)
            except Exception:
                pass


def daily_backup():
    storage.backup_database()


if __name__ == "__main__":
    os.makedirs(os.getenv("TMP_DIR", "/tmp/downloads"), exist_ok=True)
    database.init_db()

    scheduler = BlockingScheduler()
    scheduler.add_job(watcher.run_sync, "interval", hours=4, id="sync")
    scheduler.add_job(check_and_refresh_session, "interval", hours=12, id="session")
    scheduler.add_job(cleanup_tmp, "interval", hours=24, id="cleanup")
    scheduler.add_job(daily_backup, "interval", hours=24, id="backup")

    print("Scheduler started")
    scheduler.start()
