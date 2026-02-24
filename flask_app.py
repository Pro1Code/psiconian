# -*- coding: utf-8 -*-
import sys
import os

# Configurar encoding para evitar problemas con ñ y tildes
if sys.version_info[0] < 3:
    reload(sys)
    sys.setdefaultencoding('utf-8')
else:
    os.environ["PYTHONIOENCODING"] = "utf-8"

from flask import Flask, request, jsonify, send_from_directory, session, redirect
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
import bcrypt
import secrets
import threading

from flask_mail import Mail, Message

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__,
            static_folder='.',
            template_folder='.')

# =========================
# CONFIGURACIÓN DE SEGURIDAD
# =========================

app.secret_key = os.urandom(32).hex()

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=False
)

CORS(app, supports_credentials=True, origins=[
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://psiconian.onrender.com'  # Cambiado a Render
])

# =========================
# CONFIGURACIÓN DE EMAIL PARA PRODUCCIÓN
# =========================
import os

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False  # Importante: False cuando usas TLS
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_USERNAME')  # Mismo que el username
app.config['MAIL_ASCII_ATTACHMENTS'] = False
mail = Mail(app)

# =========================
# 🔒 CONFIGURACIÓN RATE LIMITER
# =========================

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# =========================
# BASE DE DATOS (SQLite)
# =========================

def init_db():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            password BLOB NOT NULL,
            name TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_progress (
            user_id INTEGER PRIMARY KEY,
            pauses INTEGER DEFAULT 0,
            exercises INTEGER DEFAULT 0,
            streak INTEGER DEFAULT 0,
            minutes INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()

init_db()

# =========================
# TABLA PARA TOKENS DE RECUPERACIÓN
# =========================
def create_recovery_table():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()

create_recovery_table()

# ============================================
# 🟢🟢🟢  UTILIDADES DE SEGURIDAD (PRIMERO)  🟢🟢🟢
# ============================================

def hash_password(password):
    """Hashea una contraseña usando bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt)

def check_password(password, hashed):
    """Verifica si la contraseña coincide con el hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

# ============================================
# 🟢🟢🟢  CREAR ADMIN POR DEFECTO (AHORA SÍ FUNCIONA)  🟢🟢🟢
# ============================================

def create_admin_user():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE is_admin = 1")
    admin = cursor.fetchone()

    if not admin:
        # AHORA SÍ, hash_password YA ESTÁ DEFINIDA
        admin_password = hash_password('Admin123!')
        cursor.execute("""
            INSERT INTO users (username, email, name, password, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ('admin', 'admin@mian.com', 'Administrador', admin_password, 1, datetime.now().isoformat()))

        conn.commit()
        print("✅ Usuario admin creado: admin@mian.com / Admin123!")

    conn.close()

# LLAMAR A LA FUNCIÓN DESPUÉS DE DEFINIRLA
create_admin_user()

# =========================
# FUNCIÓN PARA ENVIAR EMAIL DE BIENVENIDA
# =========================
def send_welcome_email_async(user_name, user_email):
    def send_email_thread():
        with app.app_context():
            try:
                # Limpiar nombre de caracteres problemáticos
                safe_name = user_name.encode('ascii', 'ignore').decode('ascii') if user_name else 'Usuario'

                msg = Message(
                    subject="Bienvenido a Mian - Tu espacio de bienestar",
                    recipients=[user_email],
                    html=f"""
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body {{ font-family: 'Inter', sans-serif; background-color: #f5f7fa; }}
                            .container {{ max-width: 600px; margin: 0 auto; padding: 30px; }}
                            .header {{ background: linear-gradient(135deg, #0B2A4A, #1E4A6F); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                            .content {{ background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }}
                            .button {{ background: #0B2A4A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }}
                            .footer {{ text-align: center; margin-top: 30px; color: #7C8A9A; font-size: 0.8rem; }}
                            .feature {{ margin: 15px 0; padding: 10px; border-left: 3px solid #0B2A4A; }}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Bienvenido a Mian!</h1>
                            </div>
                            <div class="content">
                                <h2>Hola {safe_name},</h2>
                                <p>Nos alegra muchisimo que formes parte de nuestra comunidad. En Mian, queremos acompanarte en tu camino hacia el bienestar mental y el autoconocimiento.</p>

                                <h3>Tu espacio personal incluye:</h3>

                                <div class="feature">
                                    <strong>Ejercicios de neuropsicologia</strong><br>
                                    Personalizados segun tu nivel y objetivos
                                </div>

                                <div class="feature">
                                    <strong>Seguimiento de progreso</strong><br>
                                    Visualiza tu evolucion con graficos y estadisticas
                                </div>

                                <div class="feature">
                                    <strong>Recursos exclusivos</strong><br>
                                    Audios, PDFs y videos creados para ti
                                </div>

                                <div class="feature">
                                    <strong>Comunidad privada</strong><br>
                                    Conecta con otras personas en el mismo camino
                                </div>

                                <div style="text-align: center; margin: 40px 0;">
                                    <a href="https://psiconian.onrender.com/dashboard" class="button">ACCEDER A MI ESPACIO</a>
                                </div>

                                <p><strong>Primeros pasos:</strong></p>
                                <ol>
                                    <li>Completa tu perfil en el dashboard</li>
                                    <li>Realiza tu primer ejercicio del dia</li>
                                    <li>Explora la biblioteca de recursos</li>
                                </ol>

                                <p>Si tienes cualquier duda, responde a este email. Estamos aqui para ayudarte.</p>

                                <p>Un abrazo,<br>
                                <strong>El equipo de Mian</strong></p>
                            </div>
                            <div class="footer">
                                <p>© 2025 Mian - Neuropsicologia & Bienestar. Todos los derechos reservados.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                    """,
                    charset='utf-8'
                )
                mail.send(msg)
                print(f"✅ Email de bienvenida enviado a {user_email}")
            except Exception as e:
                print(f"❌ Error en email de bienvenida: {e}")

    thread = threading.Thread(target=send_email_thread)
    thread.daemon = True
    thread.start()

# =========================
# FUNCIÓN PARA EMAIL DE RECUPERACIÓN (CORREGIDA)
# =========================
def send_recovery_email_async(user_email, user_name, reset_link):
    def send_email_thread():
        with app.app_context():
            try:
                # Verificar configuración
                if not app.config.get('MAIL_USERNAME') or not app.config.get('MAIL_PASSWORD'):
                    print("❌ ERROR: MAIL_USERNAME o MAIL_PASSWORD no están configurados")
                    return

                # Limpiar nombre de caracteres problemáticos
                safe_name = user_name.encode('ascii', 'ignore').decode('ascii') if user_name else 'Usuario'

                msg = Message(
                    subject="Recupera tu contrasena - Mian",
                    recipients=[user_email],
                    html=f"""
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body {{ font-family: 'Inter', sans-serif; background-color: #f5f7fa; }}
                            .container {{ max-width: 600px; margin: 0 auto; padding: 30px; }}
                            .header {{ background: linear-gradient(135deg, #0B2A4A, #1E4A6F); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                            .content {{ background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }}
                            .button {{ background: #0B2A4A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }}
                            .footer {{ text-align: center; margin-top: 30px; color: #7C8A9A; font-size: 0.8rem; }}
                            .warning {{ background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin: 20px 0; }}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Recuperacion de contrasena</h1>
                            </div>
                            <div class="content">
                                <h2>Hola {safe_name},</h2>
                                <p>Recibimos una solicitud para restablecer tu contrasena en Mian.</p>

                                <div style="text-align: center;">
                                    <a href="{reset_link}" class="button">RESTABLECER CONTRASENA</a>
                                </div>

                                <div class="warning">
                                    Este enlace expirara en 1 hora.
                                </div>

                                <p>Si no solicitaste este cambio, puedes ignorar este email.</p>

                                <p>Saludos,<br>
                                <strong>El equipo de Mian</strong></p>
                            </div>
                            <div class="footer">
                                <p>© 2025 Mian - Neuropsicologia & Bienestar</p>
                            </div>
                        </div>
                    </body>
                    </html>
                    """,
                    charset='utf-8'
                )

                msg.sender = app.config['MAIL_USERNAME']

                print(f"📧 Enviando email de recuperacion a: {user_email}")
                mail.send(msg)
                print(f"✅ Email de recuperacion enviado a {user_email}")

            except Exception as e:
                print(f"❌ ERROR en email de recuperacion: {e}")
                import traceback
                traceback.print_exc()

    thread = threading.Thread(target=send_email_thread)
    thread.daemon = True
    thread.start()

# =========================
# RUTAS FRONTEND
# =========================

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/dashboard')
def serve_dashboard():
    if 'user_id' not in session:
        return redirect('/')
    return send_from_directory('.', 'dashboard.html')

@app.route('/admin')
def admin_panel():
    if 'user_id' not in session:
        return redirect('/')

    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute("SELECT is_admin FROM users WHERE id = ?", (session['user_id'],))
    user = cursor.fetchone()
    conn.close()

    if not user or not user[0]:
        # Mensaje amigable para usuarios no admin
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Acceso Restringido · Mian</title>
            <style>
                body { font-family: 'Inter', sans-serif; background: #f5f7fa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: white; padding: 3rem; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
                h1 { color: #0B2A4A; margin-bottom: 1rem; }
                p { color: #7C8A9A; margin-bottom: 2rem; }
                .btn { background: #0B2A4A; color: white; padding: 0.8rem 2rem; text-decoration: none; border-radius: 4px; display: inline-block; }
                .btn:hover { background: #1E4A6F; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🔒 Acceso Restringido</h1>
                <p>Lo sentimos, esta área es exclusiva para administradores web.</p>
                <p>Si crees que esto es un error, contacta al administrador del sistema.</p>
                <a href="/dashboard" class="btn">Volver a mi espacio</a>
            </div>
        </body>
        </html>
        """, 403

    return send_from_directory('.', 'admin.html')

@app.route('/<path:path>')
def serve_static(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory('.', path)

# =========================
# API DE AUTENTICACIÓN
# =========================

@app.route('/api/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        password = data.get('password')

        if not name or not email or not password:
            return jsonify({'message': 'Nombre, email y contraseña requeridos'}), 400

        if len(password) < 8:
            return jsonify({'message': 'La contraseña debe tener mínimo 8 caracteres'}), 400

        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()

        try:
            cursor.execute(
                "INSERT INTO users (username, email, phone, password, name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (email, email, phone, hash_password(password), name, datetime.now().isoformat())
            )
            user_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO user_progress (user_id, pauses, exercises, streak, minutes) VALUES (?, ?, ?, ?, ?)",
                (user_id, 0, 0, 0, 0)
            )

            conn.commit()

            session['user_id'] = user_id
            session['user_name'] = name
            session['user_email'] = email

            # Enviar email de bienvenida
            send_welcome_email_async(name, email)

            return jsonify({
                'message': 'Usuario registrado correctamente',
                'user': {
                    'id': user_id,
                    'name': name,
                    'email': email,
                    'phone': phone
                }
            }), 201

        except sqlite3.IntegrityError as e:
            conn.close()
            if 'email' in str(e):
                return jsonify({'message': 'El email ya está registrado'}), 400
            return jsonify({'message': 'Error al registrar usuario'}), 400

        conn.close()

    except Exception as e:
        return jsonify({'message': f'Error en el servidor: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'message': 'Email y contraseña requeridos'}), 400

        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, password, name, email, phone, is_admin FROM users WHERE email = ?",
            (email,)
        )
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({'message': 'Email o contraseña incorrectos'}), 401

        user_id, stored_password, name, user_email, phone, is_admin = user

        if check_password(password, stored_password):
            session['user_id'] = user_id
            session['user_name'] = name
            session['user_email'] = user_email
            session['is_admin'] = is_admin

            return jsonify({
                'message': 'Login exitoso',
                'user': {
                    'id': user_id,
                    'name': name,
                    'email': user_email,
                    'phone': phone,
                    'is_admin': bool(is_admin)
                }
            }), 200
        else:
            return jsonify({'message': 'Email o contraseña incorrectos'}), 401

    except Exception as e:
        return jsonify({'message': f'Error en el servidor: {str(e)}'}), 500

@app.route('/api/verify_session', methods=['GET'])
def verify_session():
    if 'user_id' in session:
        return jsonify({
            'valid': True,
            'user': {
                'id': session['user_id'],
                'name': session.get('user_name', ''),
                'email': session.get('user_email', '')
            }
        }), 200
    else:
        return jsonify({'valid': False}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('user_name', None)
    session.pop('user_email', None)
    session.pop('is_admin', None)
    return jsonify({'message': 'Sesión cerrada'}), 200

# =========================
# API DE DATOS DE USUARIO
# =========================

@app.route('/api/user/progress', methods=['GET'])
def get_user_progress():
    if 'user_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    cursor.execute(
        "SELECT pauses, exercises, streak, minutes FROM user_progress WHERE user_id = ?",
        (session['user_id'],)
    )
    progress = cursor.fetchone()
    conn.close()

    if progress:
        return jsonify({
            'pauses': progress[0] or 0,
            'exercises': progress[1] or 0,
            'streak': progress[2] or 0,
            'minutes': progress[3] or 0
        })
    else:
        return jsonify({'pauses': 0, 'exercises': 0, 'streak': 0, 'minutes': 0})

@app.route('/api/user/progress', methods=['POST'])
def update_user_progress():
    if 'user_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    data = request.get_json()
    pauses = data.get('pauses', 0)
    exercises = data.get('exercises', 0)
    minutes = data.get('minutes', 0)

    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE user_progress
        SET pauses = pauses + ?,
            exercises = exercises + ?,
            minutes = minutes + ?
        WHERE user_id = ?
    ''', (pauses, exercises, minutes, session['user_id']))

    conn.commit()
    conn.close()

    return jsonify({'message': 'Progreso actualizado'}), 200

# =========================
# API DE ADMIN
# =========================

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    if 'user_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute("SELECT is_admin FROM users WHERE id = ?", (session['user_id'],))
    admin = cursor.fetchone()

    if not admin or not admin[0]:
        conn.close()
        return jsonify({'error': 'No autorizado'}), 403

    cursor.execute("""
        SELECT id, username, email, name, phone, is_admin, created_at
        FROM users ORDER BY id DESC
    """)
    users = cursor.fetchall()
    conn.close()

    user_list = []
    for u in users:
        user_list.append({
            'id': u[0],
            'username': u[1],
            'email': u[2],
            'name': u[3],
            'phone': u[4],
            'is_admin': bool(u[5]),
            'created_at': u[6]
        })

    return jsonify(user_list)

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute("SELECT is_admin FROM users WHERE id = ?", (session['user_id'],))
    admin = cursor.fetchone()

    if not admin or not admin[0]:
        conn.close()
        return jsonify({'error': 'No autorizado'}), 403

    if user_id == session['user_id']:
        conn.close()
        return jsonify({'error': 'No puedes eliminarte a ti mismo'}), 400

    try:
        cursor.execute("DELETE FROM user_progress WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Usuario eliminado correctamente'})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/send-welcome/<int:user_id>', methods=['POST'])
def send_welcome_email(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No autorizado'}), 401

    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute("SELECT is_admin FROM users WHERE id = ?", (session['user_id'],))
    admin = cursor.fetchone()

    if not admin or not admin[0]:
        conn.close()
        return jsonify({'error': 'No autorizado'}), 403

    cursor.execute("SELECT name, email FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    name, email = user
    send_welcome_email_async(name, email)

    return jsonify({'message': f'Email de bienvenida enviado a {email}'})

# ============================================
# RUTAS PARA RECUPERACIÓN DE CONTRASEÑA
# ============================================

@app.route('/api/recover-password', methods=['POST'])
@limiter.limit("3 per hour")
def recover_password():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Se esperaba JSON'}), 400

        email = data.get('email')

        if not email:
            return jsonify({'message': 'Email requerido'}), 400

        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()

        cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        # Por seguridad, siempre devolvemos el mismo mensaje
        response = {'message': 'Si el email existe, recibirás instrucciones'}

        if user:
            user_id, user_name = user
            token = secrets.token_urlsafe(32)
            expires_at = (datetime.now() + timedelta(hours=1)).isoformat()

            cursor.execute("""
                INSERT INTO password_resets (user_id, token, expires_at)
                VALUES (?, ?, ?)
            """, (user_id, token, expires_at))

            conn.commit()

            reset_link = f"https://psiconian.onrender.com/reset-password?token={token}"
            send_recovery_email_async(email, user_name or 'Usuario', reset_link)
            print(f"📧 Token generado para {email}: {token[:10]}...")

        conn.close()
        return jsonify(response), 200

    except Exception as e:
        print(f"❌ Error en recover_password: {e}")
        return jsonify({'message': f'Error en el servidor'}), 500

@app.route('/reset-password')
def reset_password_page():
    token = request.args.get('token')
    if not token:
        return "Token no válido", 400

    return send_from_directory('.', 'reset-password.html')

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        token = data.get('token')
        new_password = data.get('password')

        if not token or not new_password:
            return jsonify({'message': 'Token y contraseña requeridos'}), 400

        if len(new_password) < 8:
            return jsonify({'message': 'La contraseña debe tener mínimo 8 caracteres'}), 400

        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()

        cursor.execute("""
            SELECT user_id FROM password_resets
            WHERE token = ? AND used = 0 AND expires_at > ?
        """, (token, datetime.now().isoformat()))

        result = cursor.fetchone()

        if not result:
            conn.close()
            return jsonify({'message': 'Token inválido o expirado'}), 400

        user_id = result[0]

        # Actualizar contraseña
        cursor.execute("""
            UPDATE users SET password = ? WHERE id = ?
        """, (hash_password(new_password), user_id))

        # Marcar token como usado
        cursor.execute("""
            UPDATE password_resets SET used = 1 WHERE token = ?
        """, (token,))

        conn.commit()
        conn.close()

        return jsonify({'message': 'Contraseña actualizada correctamente'}), 200

    except Exception as e:
        return jsonify({'message': f'Error en el servidor'}), 500

# =========================
# RUTA DE PRUEBA (OPCIONAL)
# =========================
@app.route('/test-email')
def test_email():
    try:
        msg = Message(
            subject="Prueba de Email - Mian",
            recipients=["bruntaxcocyt@gmail.com"],
            body="Este es un email de prueba desde Flask. Si ves esto, el email funciona correctamente.",
            charset='utf-8'
        )
        mail.send(msg)
        return "✅ Email de prueba enviado correctamente"
    except Exception as e:
        return f"❌ Error: {str(e)}"

# =========================
# MANEJO GLOBAL 429
# =========================

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "message": "Demasiados intentos. Intenta nuevamente en unos minutos."
    }), 429

# =========================
# PRODUCCIÓN (Render)
# =========================

application = app

# =========================
# RUTA DE VERIFICACIÓN DE ENTORNO
# =========================
@app.route('/check-env')
def check_env():
    username = os.environ.get('MAIL_USERNAME', 'NO CONFIGURADO')
    password = 'CONFIGURADA' if os.environ.get('MAIL_PASSWORD') else 'NO CONFIGURADA'
    return f"MAIL_USERNAME: {username}<br>MAIL_PASSWORD: {password}"

# =========================
# DESARROLLO LOCAL
# =========================
if __name__ == '__main__':
    print("=" * 50)
    print("🚀 Servidor Flask iniciado")
    print("📍 http://localhost:5000")
    print("=" * 50)
    # Para Render, usar puerto dinámico
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)