from backend.env import ENV_FILE, PROJECT_ROOT


def test_env_file_in_project_root():
    assert ENV_FILE.resolve().parent == PROJECT_ROOT
