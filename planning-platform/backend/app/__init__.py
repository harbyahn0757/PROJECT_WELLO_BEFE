"""
건강검진 관리 시스템 백엔드 애플리케이션

의료기관 맞춤형 건강검진 서비스 플랫폼
"""

__version__ = "1.0.0"
__author__ = "PeerNine"
__email__ = "support@peernine.com"

from pathlib import Path

# 프로젝트 루트 디렉토리
ROOT_DIR = Path(__file__).parent.parent

# 데이터 디렉토리
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# 업로드 디렉토리
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# 로그 디렉토리
LOG_DIR = ROOT_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)