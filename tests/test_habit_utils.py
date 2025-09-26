from backend.utils.habit_utils import calc_progress


def test_calc_progress_empty():
    assert calc_progress({}) == 0
    assert calc_progress(None) == 0


def test_calc_progress_percent():
    progress = {"2024-01-01": True, "2024-01-02": False, "2024-01-03": True}
    assert calc_progress(progress) == 67
