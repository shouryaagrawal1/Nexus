"""Authentication module for dummy repository testing."""

class User:
    def __init__(self, username: str):
        self.username = username

    def get_role(self) -> str:
        return "standard_user"


class Admin(User):
    def __init__(self, username: str, permissions: list):
        super().__init__(username)
        self.permissions = permissions

    def get_role(self) -> str:
        return "administrator"


class AuthManager:
    def __init__(self):
        self.users = {}

    def register(self, username: str) -> User:
        user = User(username)
        self.users[username] = user
        return user

    def login(self, username: str) -> bool:
        """Authenticates the user against internal user store."""
        if username in self.users:
            return True
        return False
