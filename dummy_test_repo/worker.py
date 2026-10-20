"""Worker module showing class inheritance and function calls."""
from auth import AuthManager

def log_event(message: str):
    print(f"[WORKER LOG] {message}")

class AbstractWorker:
    def process_task(self, task_id: str):
        raise NotImplementedError("Subclasses must implement process_task")

class BaseDBWorker(AbstractWorker):
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.auth = AuthManager()

    def retry_connection(self) -> bool:
        """Retries the database connection when timeouts occur."""
        log_event("Retrying connection...")
        return True

    def process_task(self, task_id: str):
        log_event(f"Processing task {task_id}")
        return self.retry_connection()
