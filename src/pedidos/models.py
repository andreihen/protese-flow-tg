from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator

class Usuario(AbstractUser):
    TIPO_CHOICES = (
        ('GESTOR', 'Gestor'),
        ('CADISTA', 'Cadista'),
        ('DENTISTA', 'Dentista'),
    )

    username_validator = RegexValidator(
        regex=r'^[\w\s.-]+$',
        message='O nome de usuário pode conter letras, números, espaços, hífens e underlines.'
    )

    username = models.CharField(
        'Nome de Usuário',
        max_length=150,
        unique=True,
        help_text='Necessário. 150 caracteres ou menos. Letras, dígitos e @/./+/-/_/espaços.',
        validators=[username_validator],
        error_messages={
            'unique': "Já existe um usuário com este nome.",
        },
    )

    tipo_usuario = models.CharField(max_length=20, choices=TIPO_CHOICES, default='DENTISTA')
    telefone = models.CharField(max_length=20, blank=True, null=True)
    cro = models.CharField(max_length=20, blank=True, null=True, verbose_name="Número do CRO")
    esta_arquivado = models.BooleanField(default=False, verbose_name="Está na Lixeira")
    cadastro_confirmado = models.BooleanField(default=False)

class Pedido(models.Model):
    STATUS_CHOICES = (
        ('PENDENTE', 'Pendente - Aguardando Análise'),
        ('EM_PRODUCAO', 'Em Produção'),
        ('CONCLUIDO', 'Concluído - Pronto para Entrega'),
        ('CANCELADO', 'Cancelado'),
    )

    dentista = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='pedidos')
    
    nome_paciente = models.CharField(max_length=100)
    
    dentes = models.CharField(max_length=100, help_text="Ex: 11, 12, 21 (Use vírgulas)")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_entrega_prevista = models.DateField(blank=True, null=True)

    SEXO_CHOICES = (
        ('M', 'Masculino'),
        ('F', 'Feminino'),
    )

    nome_paciente = models.CharField(max_length=100, verbose_name="Nome do Paciente")
    sexo = models.CharField(max_length=1, choices=SEXO_CHOICES, default='M', verbose_name="Sexo")
    
    elementos = models.CharField(max_length=200, verbose_name="Dentes Selecionados", blank=True)
    
    tipo_servico = models.CharField(max_length=100, verbose_name="Tipo de Serviço")
    cor = models.CharField(max_length=50, blank=True, null=True, verbose_name="Cor (Ex: A2)")
    
    observacoes = models.TextField(blank=True, null=True, verbose_name="Observações / Detalhes")

    def __str__(self):
        return f"Pedido #{self.id} - {self.nome_paciente}"

class Anexo(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='anexos')
    arquivo = models.FileField(upload_to='arquivos_protese/%Y/%m/')
    descricao = models.CharField(max_length=100, blank=True, default="Arquivo STL")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Anexo do Pedido #{self.pedido.id}"