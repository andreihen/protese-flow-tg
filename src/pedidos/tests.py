from django.test import TestCase
from .models import Usuario, Pedido

class PedidoModelTest(TestCase):
    
    def setUp(self):
        self.dentista = Usuario.objects.create(
            username='doutor_teste', 
            tipo_usuario='DENTISTA'
        )
        self.dentista.set_password('12345')
        self.dentista.save()

    def test_criar_pedido_com_sucesso(self):
        pedido = Pedido.objects.create(
            dentista=self.dentista,
            nome_paciente="Teste da Silva",
            tipo_servico="Coroa",
            dentes="11",
            status="PENDENTE"
        )

        self.assertIsNotNone(pedido.id)
        self.assertEqual(pedido.nome_paciente, "Teste da Silva")
        self.assertEqual(pedido.status, "PENDENTE")
        print("\n✅ Teste de Criação de Pedido: PASSOU!")