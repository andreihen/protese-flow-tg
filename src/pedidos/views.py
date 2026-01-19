from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
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

@login_required
def editar_pedido(request, id):
    # Mesma regra de segurança
    eh_equipe_interna = request.user.is_superuser or request.user.tipo_usuario in ['GESTOR', 'CADISTA']

    if eh_equipe_interna:
        # Gestão pode tentar buscar QUALQUER id
        pedido = get_object_or_404(Pedido, id=id)
    else:
        # Dentista só pode buscar se o ID for dele. Se tentar ID de outro, dá 404.
        pedido = get_object_or_404(Pedido, id=id, dentista=request.user)

    # Lógica para saber se pode editar o status (só equipe interna)
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
            # 1. Salva o usuário no banco
            user = form.save()
            
            # 2. Faz o login automático imediatamente
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            
            # 3. Mensagem de sucesso e redirecionamento
            messages.success(request, f'Bem-vindo(a), {user.username}!')
            return redirect('dashboard')
        else:
            # Se der erro, mostra no terminal para você saber o que foi
            print("Erros do formulário:", form.errors) 
            messages.error(request, 'Erro ao criar conta. Verifique os campos abaixo.')
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
    # Apenas Gestor pode acessar
    if not eh_gestor(request.user):
        return redirect('dashboard')

    if request.method == 'POST':
        form = CriarFuncionarioForm(request.POST)
        if form.is_valid():
            novo_usuario = form.save()
            messages.success(request, f'Usuário {novo_usuario.username} criado com sucesso!')
            return redirect('lista_usuarios')
    else:
        form = CriarFuncionarioForm()

    return render(request, 'pedidos/criar_usuario_interno.html', {'form': form})

@login_required
def editar_usuario(request, id):
    # Verifica se é gestor
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
    return user.tipo_usuario in ['GESTOR', 'CADISTA'] or user.is_superuser