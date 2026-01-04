from django.db import models
from django.contrib.auth.models import AbstractUser

class Usuario(AbstractUser):
    TIPO_CHOICES = (
        ('DENTISTA', 'Dentista'),
        ('GESTOR', 'Gestor'),
        ('CADISTA', 'Cadista'),
    )
    tipo_usuario = models.CharField(max_length=20, choices=TIPO_CHOICES, default='DENTISTA')
    
    telefone = models.CharField(max_length=20, blank=True, null=True)

class Pedido(models.Model):
    STATUS_CHOICES = (
        ('PENDENTE', 'Pendente - Aguardando Análise'),
        ('EM_PRODUCAO', 'Em Produção'),
        ('CONCLUIDO', 'Concluído - Pronto para Entrega'),
        ('CANCELADO', 'Cancelado'),
    )

    dentista = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='pedidos')
    
    nome_paciente = models.CharField(max_length=100)
    
    tipo_servico = models.CharField(max_length=100, help_text="Ex: Coroa, Faceta, Protocolo")
    dentes = models.CharField(max_length=100, help_text="Ex: 11, 12, 21 (Use vírgulas)")
    cor = models.CharField(max_length=50, blank=True, null=True, help_text="Ex: A2, BL3")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_entrega_prevista = models.DateField(blank=True, null=True)

    def __str__(self):
        return f"Pedido #{self.id} - {self.nome_paciente}"

class Anexo(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='anexos')
    arquivo = models.FileField(upload_to='arquivos_protese/%Y/%m/')
    descricao = models.CharField(max_length=100, blank=True, default="Arquivo STL")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Anexo do Pedido #{self.pedido.id}"