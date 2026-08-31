import os
import django
from django.core.files import File

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from pedidos.models import Usuario, Servico, Pedido, Anexo

def run():
    print("--- Criando Contas de Médicos/Dentistas ---")
    medicos_data = [
        {
            'username': 'dr_carlos',
            'first_name': 'Dr. Carlos Andrade',
            'email': 'carlos.andrade@odontoclinica.com',
            'cro': '23456-SP',
            'telefone': '(11) 98765-4321',
            'role': 'DENTISTA',
            'cadastro_confirmado': True
        },
        {
            'username': 'dra_mariana',
            'first_name': 'Dra. Mariana Costa',
            'email': 'mariana.costa@sorriso.com',
            'cro': '34567-SP',
            'telefone': '(11) 97654-3210',
            'role': 'DENTISTA',
            'cadastro_confirmado': True
        },
        {
            'username': 'lucas_silveira',
            'first_name': 'Dr. Lucas Silveira',
            'email': 'lucas.silveira@dental.com',
            'cro': '45678-SP',
            'telefone': '(11) 96543-2109',
            'role': 'DENTISTA',
            'cadastro_confirmado': True
        }
    ]

    medicos_criados = []
    for data in medicos_data:
        user, created = Usuario.objects.get_or_create(
            username=data['username'],
            defaults={
                'first_name': data['first_name'],
                'email': data['email'],
                'cro': data['cro'],
                'telefone': data['telefone'],
                'role': data['role'],
                'cadastro_confirmado': data['cadastro_confirmado']
            }
        )
        if created:
            user.set_password('Password123')
            user.save()
            print(f"Médico {user.first_name} ({user.username}) criado com sucesso!")
        else:
            print(f"Médico {user.first_name} ({user.username}) já existe.")
        medicos_criados.append(user)

    print("\n--- Adicionando Serviços ---")
    servicos_data = [
        {'nome': 'Coroa Total Zircônia', 'valor': 450.00, 'tipo': 'ELEMENTO', 'requer_implante': False},
        {'nome': 'Faceta Porcelana / E-max', 'valor': 600.00, 'tipo': 'ELEMENTO', 'requer_implante': False},
        {'nome': 'Prótese Sobre Implante', 'valor': 850.00, 'tipo': 'ELEMENTO', 'requer_implante': True},
        {'nome': 'Placa Miorrelaxante (Bruxismo)', 'valor': 320.00, 'tipo': 'ARCADA', 'requer_implante': False},
        {'nome': 'Protocolo Total em Resina', 'valor': 2400.00, 'tipo': 'BOCA', 'requer_implante': True},
        {'nome': 'Inlay / Onlay em Dissilicato', 'valor': 500.00, 'tipo': 'ELEMENTO', 'requer_implante': False},
    ]

    for s_data in servicos_data:
        serv, created = Servico.objects.get_or_create(
            nome=s_data['nome'],
            defaults={
                'valor': s_data['valor'],
                'tipo': s_data['tipo'],
                'requer_implante': s_data['requer_implante'],
                'ativo': True
            }
        )
        if created:
            print(f"Serviço '{serv.nome}' (R$ {serv.valor}) criado com sucesso!")
        else:
            print(f"Serviço '{serv.nome}' já existe.")

    print("\n--- Criando Pedidos de Exemplo com 'arquivo teste' como Anexo ---")
    arquivo_teste_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'arquivo teste')
    
    if os.path.exists(arquivo_teste_path):
        for idx, medico in enumerate(medicos_criados, start=1):
            pedido, p_created = Pedido.objects.get_or_create(
                dentista=medico,
                nome_paciente=f"Paciente Teste {idx}",
                defaults={
                    'sexo': 'M' if idx % 2 != 0 else 'F',
                    'dentes': '11, 12, 21',
                    'tipo_servico': 'Coroa Total Zircônia',
                    'cor': 'A2',
                    'observacoes': f'Pedido inicial criado para testes do médico {medico.first_name}.',
                    'status': 'PENDENTE'
                }
            )
            if p_created:
                with open(arquivo_teste_path, 'rb') as f:
                    anexo = Anexo(pedido=pedido, descricao="arquivo teste.stl")
                    anexo.arquivo.save('arquivo_teste.stl', File(f), save=True)
                print(f"Pedido #{pedido.id} criado para {medico.first_name} com anexo 'arquivo teste.stl'!")

if __name__ == '__main__':
    run()
