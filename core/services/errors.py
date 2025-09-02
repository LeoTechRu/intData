class CooldownError(Exception):
    """Raised when habit action is on cooldown."""
    def __init__(self, retry_after: int) -> None:
        super().__init__("cooldown")
        self.retry_after = retry_after


class InsufficientGoldError(Exception):
    """Raised when user has not enough gold."""
    pass
