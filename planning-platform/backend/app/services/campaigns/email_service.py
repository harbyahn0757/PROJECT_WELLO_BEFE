from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_disease_prediction_report_email(email, user_name, report_url):
    """
    질병예측 리포트 PDF 링크를 이메일로 발송
    """
    if not email:
        logger.error("Email address is missing")
        return False
        
    try:
        subject = f"[쏙(Xog)] {user_name}님의 AI 질병예측 리포트가 도착했습니다."
        message = f"""
안녕하세요, {user_name}님. 쏙(Xog)입니다.

결제하신 AI 질병예측 리포트가 생성되었습니다.
아래 링크를 통해 리포트(PDF)를 확인하실 수 있습니다.

리포트 확인하기: {report_url}

감사합니다.
쏙(Xog) 드림
        """
        
        html_message = f"""
        <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333; border-bottom: 2px solid #ffcc00; padding-bottom: 10px;">AI 질병예측 리포트</h2>
            <p style="font-size: 16px; color: #555;">안녕하세요, <strong>{user_name}님</strong>. 쏙(Xog)입니다.</p>
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
            <p style="font-size: 14px; font-weight: bold; color: #333; margin-top: 20px;">쏙(Xog) 드림</p>
        </div>
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False
        )
        
        logger.info(f"Report email sent to: {email}")
        return True
    except Exception as e:
        logger.error(f"Error sending report email: {str(e)}")
        return False
