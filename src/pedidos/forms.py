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
        fields = ['username', 'first_name', 'email', 'telefone', 'cro']
        
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'telefone': forms.TextInput(attrs={'class': 'form-control'}),
            'cro': forms.TextInput(attrs={'class': 'form-control'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        cro = cleaned_data.get("cro")
        
        usuario_atual = self.instance
        
        if usuario_atual.tipo_usuario == 'DENTISTA' and not cro:
            self.add_error('cro', "O CRO não pode ficar vazio para dentistas.")
            
        return cleaned_data

class MeuPerfilForm(forms.ModelForm):
    class Meta:
        model = Usuario
        fields = ['first_name', 'username', 'email', 'telefone']
        
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'telefone': forms.TextInput(attrs={'class': 'form-control'}),
        }

class CriarFuncionarioForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, label="Senha")
    
    class Meta:
        model = Usuario
        fields = ['username', 'first_name', 'email', 'tipo_usuario', 'password']
        
    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        user.cadastro_confirmado = True
        if commit:
            user.save()
        return user
    
class CriarUsuarioCompletoForm(forms.ModelForm):
    password1 = forms.CharField(required=True)
    password2 = forms.CharField(required=True)
    cro = forms.CharField(required=False)

    class Meta:
        model = Usuario
        fields = ['username', 'first_name', 'email', 'telefone', 'cro', 'tipo_usuario']

    def clean(self):
        cleaned_data = super().clean()
        senha1 = cleaned_data.get("password1")
        senha2 = cleaned_data.get("password2")
        tipo = cleaned_data.get("tipo_usuario")
        cro = cleaned_data.get("cro")

        if senha1 and senha2 and senha1 != senha2:
            self.add_error('password1', "As senhas não conferem.")

        if tipo == 'DENTISTA' and not cro:
            self.add_error('cro', "O CRO é obrigatório para dentistas.")

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        user.cadastro_confirmado = True
        if commit:
            user.save()
        return user