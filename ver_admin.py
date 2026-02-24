import sqlite3

conn = sqlite3.connect('users.db')
cursor = conn.cursor()

# Ver todos los usuarios
print("=== USUARIOS ===")
cursor.execute("SELECT id, name, email, is_admin FROM users")
for user in cursor.fetchall():
    print(f"ID: {user[0]}, Nombre: {user[1]}, Email: {user[2]}, Admin: {'✅ SÍ' if user[3] == 1 else '❌ NO'}")

# Hacer admin a tu correo
email = 'bruntaxcocyt@gmail.com'
cursor.execute("UPDATE users SET is_admin = 1 WHERE email = ?", (email,))
conn.commit()

print(f"\n✅ Usuario {email} actualizado a ADMIN")

# Verificar
cursor.execute("SELECT name, email, is_admin FROM users WHERE email = ?", (email,))
user = cursor.fetchone()
print(f"Verificación: {user[0]} - Admin: {'✅ SÍ' if user[2] == 1 else '❌ NO'}")

conn.close()