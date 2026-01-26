import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
import logging
import os

logger = logging.getLogger(__name__)

def send_disease_prediction_report_email(email, user_name, report_url):
    """
    질병예측 리포트 PDF 링크를 이메일로 발송 (SMTP 직접 사용)
    """
    if not email:
        logger.error("Email address is missing")
        return False
    
    try:
        # 환경변수에서 이메일 설정 가져오기
        smtp_host = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('EMAIL_PORT', '587'))
        smtp_user = os.getenv('EMAIL_HOST_USER', '')
        smtp_password = os.getenv('EMAIL_HOST_PASSWORD', '')
        from_email = os.getenv('DEFAULT_FROM_EMAIL', 'no-reply@kindhabit.com')
        
        # 이메일 설정이 없으면 로그만 남기고 실패 반환
        if not smtp_user or not smtp_password:
            logger.warning(f"Email configuration missing. SMTP_USER: {bool(smtp_user)}, SMTP_PASSWORD: {bool(smtp_password)}")
            logger.warning(f"Would send email to {email} with report_url: {report_url}")
            return False
        
        subject = f"[웰노] {user_name}님의 AI 질병예측 리포트가 도착했습니다."
        
        # 텍스트 메시지
        text_message = f"""
안녕하세요, {user_name}님. 웰노입니다.

결제하신 AI 질병예측 리포트가 생성되었습니다.
아래 링크를 통해 리포트(PDF)를 확인하실 수 있습니다.

리포트 확인하기: {report_url}

감사합니다.
웰노 드림
        """
        
        # HTML 메시지
        html_message = f"""
        <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333; border-bottom: 2px solid #ffcc00; padding-bottom: 10px;">AI 질병예측 리포트</h2>
            <p style="font-size: 16px; color: #555;">안녕하세요, <strong>{user_name}님</strong>. 웰노입니다.</p>
            <p style="font-size: 15px; color: #666; line-height: 1.6;">
                고객님의 건강 데이터를 기반으로 정밀 분석한 <strong>AI 질병예측 리포트</strong>가 생성되었습니다.<br/>
                아래 버튼을 눌러 상세 분석 결과를 확인해 보세요.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{report_url}" style="background-color: #ffcc00; color: #333; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 16px;">리포트 확인하기 (PDF)</a>
            </div>
            <p style="font-size: 13px; color: #999; border-top: 1px solid #eee; padding-top: 15px;">
                * 본 리포트는 보안을 위해 일정 기간 후 링크가 만료될 수 있습니다.<br/>
                * 문의사항이 있으시면 고객센터로 연락 주시기 바랍니다.
            </p>
            <p style="font-size: 14px; font-weight: bold; color: #333; margin-top: 20px;">웰노 드림</p>
        </div>
        """
        
        # 이메일 메시지 생성
        msg = MIMEMultipart('alternative')
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = from_email
        msg['To'] = email
        
        # 텍스트 및 HTML 파트 추가
        text_part = MIMEText(text_message, 'plain', 'utf-8')
        html_part = MIMEText(html_message, 'html', 'utf-8')
        msg.attach(text_part)
        msg.attach(html_part)
        
        # SMTP 서버 연결 및 이메일 발송
        use_tls = os.getenv('EMAIL_USE_TLS', 'true').lower() == 'true'
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        logger.info(f"Report email sent to: {email}")
        return True
    except Exception as e:
        logger.error(f"Error sending report email: {str(e)}", exc_info=True)
        return False
