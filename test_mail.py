import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Tus credenciales
email = "bruntaxcocyt@gmail.com"
password = "tu-contraseña-de-16-digitos"  # CON ESPACIOS

# Configuración
msg = MIMEMultipart()
msg['From'] = email
msg['To'] = email
msg['Subject'] = "Prueba directa SMTP"

body = "Este es un test directo con SMTP"
msg.attach(MIMEText(body, 'plain'))

try:
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login(email, password)
    text = msg.as_string()
    server.sendmail(email, email, text)
    server.quit()
    print("✅ Email enviado con SMTP directo")
except Exception as e:
    print(f"❌ Error: {e}")