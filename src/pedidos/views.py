from django.shortcuts import render, redirect
from .forms import PedidoForm, AnexoForm
from .models import Pedido
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from .forms import CadastroForm
from django.contrib.auth import login
from django.contrib import messages
from .models import Anexo, Usuario
from .forms import PedidoForm, AnexoForm, CadastroForm, EditarUsuarioForm, MeuPerfilForm



@login_required
def novo_pedido(request):
    if request.method == 'POST':
        form_pedido = PedidoForm(request.POST)
        form_anexo = AnexoForm(request.POST, request.FILES)

        if form_pedido.is_valid() and form_anexo.is_valid():
            pedido = form_pedido.save(commit=False)
            pedido.dentista = request.user
            pedido.save()

            anexo = form_anexo.save(commit=False)
            anexo.pedido = pedido
            anexo.save()

            return render(request, 'pedidos/sucesso.html')
    else:
        form_pedido = PedidoForm()
        form_anexo = AnexoForm()

    return render(request, 'pedidos/cadastro_pedido.html', {
        'form_pedido': form_pedido,
        'form_anexo': form_anexo
    })

def dashboard(request):
    pedidos = Pedido.objects.all().order_by('-data_criacao')
    return render(request, 'pedidos/dashboard.html', {'pedidos': pedidos})


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

@login_required
def dashboard(request):
    eh_equipe_interna = request.user.is_superuser or request.user.tipo_usuario in ['GESTOR', 'CADISTA']

    if eh_equipe_interna:
        pedidos = Pedido.objects.all().order_by('-data_criacao')
    else:
        pedidos = Pedido.objects.filter(dentista=request.user).order_by('-data_criacao')
    
    return render(request, 'pedidos/dashboard.html', {'pedidos': pedidos})

def cadastrar(request):
    if request.method == 'POST':
        form = CadastroForm(request.POST)
        if form.is_valid():
            usuario = form.save()
            login(request, usuario)
            messages.success(request, 'Cadastro realizado com sucesso! Bem-vindo ao ProteseFlow.')
            
            return redirect('dashboard')
        else:
            messages.error(request, 'Erro ao cadastrar. Verifique os campos abaixo.')
    else:
        form = CadastroForm()
    
    return render(request, 'pedidos/cadastro_usuario.html', {'form': form})

def eh_gestor(user):
    return user.tipo_usuario in ['GESTOR', 'CADISTA'] or user.is_superuser

@login_required
def lista_usuarios(request):
    if not eh_gestor(request.user):
        messages.error(request, 'Acesso negado. Apenas gestores podem gerenciar usuários.')
        return redirect('dashboard')

    usuarios = Usuario.objects.all().order_by('username')
    return render(request, 'pedidos/lista_usuarios.html', {'usuarios': usuarios})

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
        usuario_alvo.delete()
        messages.success(request, 'Usuário removido com sucesso.')
        return redirect('lista_usuarios')
    
    return render(request, 'pedidos/confirmar_exclusao_usuario.html', {'usuario_alvo': usuario_alvo})

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