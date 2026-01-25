from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth import login
from django.contrib import messages
from .models import Anexo, Usuario, Pedido
from .forms import (
    PedidoForm, AnexoForm, CadastroForm, 
    EditarUsuarioForm, MeuPerfilForm, CriarFuncionarioForm
)

@login_required
def dashboard(request):
    eh_equipe_interna = request.user.is_superuser or request.user.tipo_usuario in ['GESTOR', 'CADISTA']

    if eh_equipe_interna:
        pedidos = Pedido.objects.all().order_by('-data_criacao')
    else:
        pedidos = Pedido.objects.filter(dentista=request.user).order_by('-data_criacao')
    
    return render(request, 'pedidos/dashboard.html', {'pedidos': pedidos})

@login_required
def novo_pedido(request):
    if not request.user.cadastro_confirmado and not request.user.is_superuser:
        messages.warning(request, 'Sua conta ainda está em análise pelo Gestor. Você não pode criar pedidos ainda.')
        return redirect('dashboard')
    
    if request.method == 'POST':
        form_pedido = PedidoForm(request.POST, request.FILES, user=request.user)
        form_anexo = AnexoForm(request.POST, request.FILES)

        if form_pedido.is_valid() and form_anexo.is_valid():
            pedido = form_pedido.save(commit=False)
            
            if not (request.user.tipo_usuario == 'GESTOR' or request.user.is_superuser):
                pedido.dentista = request.user
            
            pedido.save()

            anexo = form_anexo.save(commit=False)
            anexo.pedido = pedido
            anexo.save()

            messages.success(request, 'Pedido criado com sucesso!')
            return redirect('dashboard')
    else:
        form_pedido = PedidoForm(user=request.user)
        form_anexo = AnexoForm()

    return render(request, 'pedidos/cadastro_pedido.html', {
        'form_pedido': form_pedido,
        'form_anexo': form_anexo
    })

@login_required
def editar_pedido(request, id):
    eh_equipe_interna = request.user.is_superuser or request.user.tipo_usuario in ['GESTOR', 'CADISTA']

    if eh_equipe_interna:
        pedido = get_object_or_404(Pedido, id=id)
    else:
        pedido = get_object_or_404(Pedido, id=id, dentista=request.user)

    pode_editar_status = eh_equipe_interna

    if request.method == 'POST' and pode_editar_status:
        novo_status = request.POST.get('status')
        if novo_status:
            pedido.status = novo_status
            pedido.save()
            return redirect('dashboard')

    return render(request, 'pedidos/editar_pedido.html', {
        'pedido': pedido,
        'pode_editar_status': pode_editar_status
    })

def cadastrar(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        form = CadastroForm(request.POST)

        if form.is_valid():
            user = form.save(commit=False)
            user.cadastro_confirmado = False
            user.save()

            login(request, user, backend='django.contrib.auth.backends.ModelBackend')

            messages.success(request, 'Cadastro realizado! Seu acesso está limitado até a validação do CRO.')
            return redirect('dashboard')
        else:
            pass 
            
    else:
        form = CadastroForm()

    return render(request, 'pedidos/cadastro_usuario.html', {'form': form})

@login_required
def meu_perfil(request):
    usuario = request.user

    if request.method == 'POST':
        form = MeuPerfilForm(request.POST, instance=usuario)
        if form.is_valid():
            form.save()
            messages.success(request, 'Seus dados foram atualizados com sucesso!')
            return redirect('meu_perfil')
    else:
        form = MeuPerfilForm(instance=usuario)

    return render(request, 'pedidos/meu_perfil.html', {'form': form})

@login_required
def lista_usuarios(request):
    if not eh_gestor(request.user):
        messages.error(request, 'Acesso negado. Apenas gestores podem gerenciar usuários.')
        return redirect('dashboard')

    usuarios = Usuario.objects.filter(esta_arquivado=False).order_by('username')
    return render(request, 'pedidos/lista_usuarios.html', {'usuarios': usuarios})

@login_required
def criar_usuario(request):
    if not eh_gestor(request.user):
        return redirect('dashboard')

    if request.method == 'POST':
        form = CadastroForm(request.POST)
        
        if form.is_valid():
            novo_usuario = form.save()
            novo_usuario.cadastro_confirmado = True
            novo_usuario.save()

            messages.success(request, f'Usuário {novo_usuario.username} criado com sucesso!')
            return redirect('lista_usuarios')
    else:   
        form = CadastroForm()

    return render(request, 'pedidos/criar_usuario_interno.html', {'form': form})

@login_required
def editar_usuario(request, id):
    if not eh_gestor(request.user):
        return redirect('dashboard')

    usuario_alvo = get_object_or_404(Usuario, id=id)

    if request.method == 'POST':
        form = EditarUsuarioForm(request.POST, instance=usuario_alvo)
        if form.is_valid():
            form.save()
            messages.success(request, f'Usuário {usuario_alvo.username} atualizado com sucesso!')
            return redirect('lista_usuarios')
    else:
        form = EditarUsuarioForm(instance=usuario_alvo)

    return render(request, 'pedidos/editar_usuario.html', {'form': form, 'usuario_alvo': usuario_alvo})

@login_required
def excluir_usuario(request, id):
    if not eh_gestor(request.user):
        return redirect('dashboard')

    usuario_alvo = get_object_or_404(Usuario, id=id)

    if usuario_alvo == request.user:
        messages.error(request, 'Você não pode excluir sua própria conta!')
        return redirect('lista_usuarios')

    if request.method == 'POST':
        usuario_alvo.esta_arquivado = True
        usuario_alvo.is_active = False
        usuario_alvo.save()
        
        messages.warning(request, f'Usuário {usuario_alvo.username} enviado para a lixeira.')
        return redirect('lista_usuarios')
    
    return render(request, 'pedidos/confirmar_exclusao_usuario.html', {'usuario_alvo': usuario_alvo})


@login_required
def lixeira_usuarios(request):
    if not eh_gestor(request.user):
        return redirect('dashboard')
    
    usuarios_arquivados = Usuario.objects.filter(esta_arquivado=True)
    return render(request, 'pedidos/lixeira_usuarios.html', {'usuarios': usuarios_arquivados})

@login_required
def restaurar_usuario(request, id):
    if not eh_gestor(request.user):
        return redirect('dashboard')
        
    usuario = get_object_or_404(Usuario, id=id)
    
    usuario.esta_arquivado = False
    usuario.is_active = True
    usuario.save()
    
    messages.success(request, f'Usuário {usuario.username} restaurado com sucesso!')
    return redirect('lixeira_usuarios')

@login_required
def deletar_permanente(request, id):
    if not eh_gestor(request.user):
        return redirect('dashboard')
        
    usuario = get_object_or_404(Usuario, id=id)
    
    if request.method == 'POST':
        usuario.delete()
        messages.error(request, 'Usuário excluído permanentemente.')
        return redirect('lixeira_usuarios')
        
    return render(request, 'pedidos/confirmar_exclusao_permanente.html', {'usuario_alvo': usuario})

def eh_gestor(user):
    return user.is_authenticated and (user.tipo_usuario == 'GESTOR' or user.is_superuser)

@login_required
@user_passes_test(eh_gestor)
def lista_aprovacao(request):
    pendentes = Usuario.objects.filter(cadastro_confirmado=False).exclude(is_superuser=True)
    return render(request, 'pedidos/lista_aprovacao.html', {'pendentes': pendentes})

@login_required
@user_passes_test(eh_gestor)
def aprovar_usuario(request, user_id):
    usuario = get_object_or_404(Usuario, id=user_id)
    
    usuario.cadastro_confirmado = True
    usuario.save()
    
    messages.success(request, f'Dentista {usuario.username} autorizado com sucesso!')
    return redirect('lista_aprovacao')

@login_required
@user_passes_test(eh_gestor)
def rejeitar_usuario(request, user_id):
    usuario = get_object_or_404(Usuario, id=user_id)
    usuario.delete()
    messages.warning(request, f'Solicitação de {usuario.username} foi rejeitada e excluída.')
    return redirect('lista_aprovacao')