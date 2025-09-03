class CooldownError(Exception):
    """Raised when habit action is on cooldown."""
    def __init__(self, seconds: int) -> None:
        super().__init__("cooldown")
        self.seconds = seconds


class InsufficientGoldError(Exception):
    """Raised when user has not enough gold."""
    pass
