from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import Usuario, Pedido, Anexo

class CadastroForm(UserCreationForm):
    cro = forms.CharField(
        max_length=20, 
        required=True, 
        label="CRO",
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: 12345-SP'})
    )

    class Meta:
        model = Usuario
        fields = ['username', 'email', 'telefone', 'cro', 'first_name']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = 'form-control'

        self.fields['username'].help_text = None

        self.fields['first_name'].label = "Nome Completo"
        self.fields['first_name'].required = True
        self.fields['first_name'].widget.attrs['placeholder'] = "Ex: João da Silva"

        self.fields['password1'] = forms.CharField(
                label="Senha",
                widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Digite sua senha'})
            )
        
        self.fields['password2'] = forms.CharField(
            label="Confirmar Senha",
            widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Repita a senha'})
        )

class PedidoForm(forms.ModelForm):
    class Meta:
        model = Pedido
        fields = ['nome_paciente', 'sexo', 'tipo_servico', 'cor', 'data_entrega_prevista', 'observacoes', 'elementos']
        
        widgets = {
            'sexo': forms.RadioSelect(attrs={'class': 'form-check-input'}),
            'data_entrega_prevista': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'observacoes': forms.Textarea(attrs={'rows': 3, 'class': 'form-control'}),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        for field_name, field in self.fields.items():
            if field_name != 'sexo':
                field.widget.attrs['class'] = 'form-control'

class AnexoForm(forms.ModelForm):
    class Meta:
        model = Anexo
        fields = ['arquivo']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['arquivo'].widget.attrs.update({'class': 'form-control'})

class EditarUsuarioForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['username', 'email', 'telefone', 'tipo_usuario', 'cro']

class MeuPerfilForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['username', 'email', 'telefone']

class CriarFuncionarioForm(UserCreationForm):
    class Meta:
        model = Usuario
        fields = ['username', 'email', 'telefone', 'cro', 'tipo_usuario']