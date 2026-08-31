from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator

class Usuario(AbstractUser):
    ROLE_CHOICES = (
        ('GESTOR', 'Gestor'),
        ('OPERADOR', 'Operador'),
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

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='DENTISTA')
    telefone = models.CharField(max_length=20, blank=True, null=True)
    cro = models.CharField(max_length=20, blank=True, null=True, verbose_name="Número do CRO")
    esta_arquivado = models.BooleanField(default=False, verbose_name="Está na Lixeira")
    cadastro_confirmado = models.BooleanField(default=False)

class Servico(models.Model):
    TIPO_CHOICES = (
        ('ELEMENTO', 'Por Dente / Elemento'),
        ('ARCADA', 'Por Arcada'),
        ('BOCA', 'Global / Boca Inteira'),
    )

    nome = models.CharField(max_length=150, unique=True, verbose_name="Nome do Serviço")
    valor = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Valor (R$)")
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='ELEMENTO', verbose_name="Tipo de Aplicação")
    requer_implante = models.BooleanField(default=False, verbose_name="Requer Componentes de Implante")
    
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.nome} - R$ {self.valor}"

class Pedido(models.Model):
    STATUS_CHOICES = (
        ('PENDENTE', 'Pendente'),
        ('INICIADO', 'Iniciado'),
        ('RETRABALHO_OPERADOR', 'Retrabalho Operador'),
        ('RETRABALHO_CLIENTE', 'Retrabalho Cliente'),
        ('EM_APROVACAO', 'Em Aprovação'),
        ('FINALIZADO', 'Finalizado'),
        ('CANCELADO', 'Cancelado'),
    )

    SEXO_CHOICES = (
        ('M', 'Masculino'),
        ('F', 'Feminino'),
    )

    dentista = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='pedidos')
    operador = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='pedidos_alocados')

    arquivo_entregavel = models.FileField(upload_to='entregas/', null=True, blank=True)
    
    nome_paciente = models.CharField(max_length=100, verbose_name="Nome do Paciente")
    sexo = models.CharField(max_length=1, choices=SEXO_CHOICES, default='M', verbose_name="Sexo")
    dentes = models.TextField(verbose_name="Dentes Selecionados", help_text="Ex: 11, 12, 21 (Use vírgulas)")
    elementos = models.TextField(verbose_name="Odontograma JSON", blank=True, default="{}")
    
    tipo_servico = models.TextField(verbose_name="Tipo de Serviço")
    componentes_implante = models.TextField(verbose_name="Componentes de Implante JSON", blank=True, null=True)
    cor = models.CharField(max_length=100, blank=True, null=True, verbose_name="Cor (Ex: A2)")
    observacoes = models.TextField(blank=True, null=True, verbose_name="Observações / Detalhes")
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDENTE')
    urgente = models.BooleanField(default=False, verbose_name="Urgente")
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_conclusao = models.DateTimeField(null=True, blank=True, verbose_name="Data de Conclusão")
    
    prazo_original = models.DateTimeField(blank=True, null=True)
    prazo_ajustado = models.DateTimeField(blank=True, null=True)

    # Optimistic Concurrency Control
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Pedido #{self.id} - {self.nome_paciente}"

class Historico_Pedidos(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='historico')
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    status_anterior = models.CharField(max_length=30, blank=True, null=True)
    status_novo = models.CharField(max_length=30)
    motivo_retrabalho = models.TextField(null=True, blank=True)
    detalhes_alteracao = models.TextField(null=True, blank=True, verbose_name="Detalhes da Alteração")
    data_transicao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_transicao']

    def __str__(self):
        return f"Histórico do Pedido #{self.pedido.id} ({self.status_novo})"

class Anexo(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='anexos')
    arquivo = models.FileField(upload_to='arquivos_protese/%Y/%m/')
    descricao = models.CharField(max_length=100, blank=True, default="Arquivo STL")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Anexo do Pedido #{self.pedido.id}"

class Configuracao(models.Model):
    inicio_expediente = models.TimeField(default="08:00:00", verbose_name="Início do Expediente")
    fim_expediente = models.TimeField(default="18:00:00", verbose_name="Fim do Expediente")
    prazo_urgencia = models.PositiveIntegerField(default=3, verbose_name="Prazo de Urgência (Horas Úteis)")

    @classmethod
    def get_solo(cls):
        obj, created = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return f"Configurações - {self.inicio_expediente} às {self.fim_expediente}"

class DiaExcecao(models.Model):
    data = models.DateField(unique=True, verbose_name="Data da Exceção")
    trabalha = models.BooleanField(default=False, verbose_name="Trabalha?")
    descricao = models.CharField(max_length=255, blank=True, null=True, verbose_name="Descrição")

    def __str__(self):
        status = "Trabalha" if self.trabalha else "Não Trabalha"
        return f"{self.data} - {status}"