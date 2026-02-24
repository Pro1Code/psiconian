import sqlite3

conn = sqlite3.connect('users.db')
cursor = conn.cursor()

# Ver qué columnas existen actualmente
print("=== COLUMNAS ACTUALES ===")
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]} - {col[2]}")

# Agregar columna is_admin si no existe
try:
    cursor.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
    print("\n✅ Columna 'is_admin' agregada correctamente")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e) or "already exists" in str(e):
        print("\n⚠️ La columna 'is_admin' ya existe")
    else:
        print(f"\n❌ Error: {e}")

# Verificar que se agregó
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()
print("\n=== COLUMNAS DESPUÉS DE LA MIGRACIÓN ===")
for col in columns:
    admin_marker = " 👑" if col[1] == 'is_admin' else ""
    print(f"  {col[1]} - {col[2]}{admin_marker}")

# Hacer admin al usuario específico
email = 'bruntaxcocyt@gmail.com'
cursor.execute("UPDATE users SET is_admin = 1 WHERE email = ?", (email,))
conn.commit()

# Verificar
cursor.execute("SELECT name, email, is_admin FROM users WHERE email = ?", (email,))
user = cursor.fetchone()
if user:
    print(f"\n✅ Usuario {user[0]} ({user[1]}) ahora es ADMIN: {user[2] == 1}")
else:
    print(f"\n⚠️ No se encontró el usuario con email {email}")

conn.close()