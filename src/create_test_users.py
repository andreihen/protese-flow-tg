import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from pedidos.models import Usuario

Usuario.objects.create_user(username='admin', password='Password123', role='GESTOR', is_superuser=True, is_staff=True, email='admin@test.com', first_name='Gestor Admin')
Usuario.objects.create_user(username='dentista', password='Password123', role='DENTISTA', cro='12345-SP', email='dentista@test.com', first_name='Dr. Roberto')
Usuario.objects.create_user(username='operador', password='Password123', role='OPERADOR', email='operador@test.com', first_name='Operador CAD')
print("Test users created!")
