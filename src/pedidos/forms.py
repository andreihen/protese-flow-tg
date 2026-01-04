from django import forms
from .models import Pedido, Anexo
from django.contrib.auth.forms import UserCreationForm
from .models import Usuario

class PedidoForm(forms.ModelForm):
    class Meta:
        model = Pedido
        fields = ['nome_paciente', 'tipo_servico', 'dentes', 'cor', 'data_entrega_prevista']

class AnexoForm(forms.ModelForm):
    class Meta:
        model = Anexo
        fields = ['arquivo', 'descricao']

class CadastroForm(UserCreationForm):
    class Meta:
        model = Usuario
        fields = ['username', 'email', 'telefone', 'tipo_usuario']

class EditarUsuarioForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['username', 'email', 'telefone', 'tipo_usuario']

class MeuPerfilForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['username', 'email', 'telefone'] 