from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth import login
from django.contrib import messages
from django.db.models import (
    Q, Count
)
from .models import Anexo, Usuario, Pedido
from .forms import (
    PedidoForm, AnexoForm, CadastroForm, 
    EditarUsuarioForm, MeuPerfilForm, CriarFuncionarioForm
)

@login_required
def dashboard(request):
    eh_gestor = request.user.tipo_usuario in ['GESTOR', 'CADISTA'] or request.user.is_superuser
    
    if eh_gestor:
        qs_base = Pedido.objects.all()
    else:
        qs_base = Pedido.objects.filter(dentista=request.user)

    kpi_pendentes = qs_base.filter(status='PENDENTE').count()
    kpi_iniciados = qs_base.filter(status='EM_PRODUCAO').count()
    kpi_finalizados = qs_base.filter(status='CONCLUIDO').count()
    kpi_aprovados = qs_base.filter(status='APROVADO').count()

    status_selecionado = request.GET.get('status')
    
    if status_selecionado:
        pedidos = qs_base.filter(status=status_selecionado).order_by('-data_criacao')
    else:
        pedidos = qs_base.order_by('-data_criacao')[:5]

    return render(request, 'pedidos/dashboard.html', {
        'pedidos': pedidos,
        'eh_gestor': eh_gestor,
        'status_selecionado': status_selecionado,
        'kpi_pendentes': kpi_pendentes,
        'kpi_iniciados': kpi_iniciados,
        'kpi_finalizados': kpi_finalizados,
        'kpi_aprovados': kpi_aprovados,
    })

@login_required
def novo_pedido(request):
    if not request.user.cadastro_confirmado and not request.user.is_superuser:
        messages.warning(request, 'Sua conta ainda está em análise. Aguarde a aprovação.')
        return redirect('dashboard')
    
    if request.method == 'POST':
        form_pedido = PedidoForm(request.POST, request.FILES)
        form_anexo = AnexoForm(request.POST, request.FILES)

        if form_pedido.is_valid() and form_anexo.is_valid():
            pedido = form_pedido.save(commit=False)
            
            pedido.dentista = request.user 
            
            pedido.save()

            anexo = form_anexo.save(commit=False)
            anexo.pedido = pedido
            anexo.save()

            messages.success(request, 'Pedido criado com sucesso!')
            return redirect('dashboard')
    else:
        form_pedido = PedidoForm()
        form_anexo = AnexoForm()

    return render(request, 'pedidos/cadastro_pedido.html', {
        'form_pedido': form_pedido,
        'form_anexo': form_anexo
    })

@login_required
def editar_pedido(request, id):
    eh_equipe_interna = request.user.tipo_usuario in ['GESTOR', 'CADISTA'] or request.user.is_superuser

    if eh_equipe_interna:
        pedido = get_object_or_404(Pedido, id=id)
    else:
        pedido = get_object_or_404(Pedido, id=id, dentista=request.user)

    if request.method == 'POST':
        form = PedidoForm(request.POST, request.FILES, instance=pedido)
        
        if form.is_valid():
            obj = form.save(commit=False)
            
            if eh_equipe_interna:
                novo_status = request.POST.get('status_extra')
                if novo_status:
                    obj.status = novo_status
            
            obj.save()
            messages.success(request, 'Alterações salvas com sucesso!')
            return redirect('lista_pedidos')
    else:
        form = PedidoForm(instance=pedido)

    return render(request, 'pedidos/editar_pedido.html', {
        'form': form,
        'pedido': pedido,
        'eh_equipe_interna': eh_equipe_interna,
        'status_choices': Pedido.STATUS_CHOICES
    })

def cadastrar(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        form = CadastroForm(request.POST)

        if form.is_valid():
            user = form.save(commit=False)
            
            user.tipo_usuario = 'DENTISTA'
            user.cadastro_confirmado = True
            
            user.save()

            messages.success(request, '✅ Conta criada com sucesso! Por favor, faça seu login.')
            return redirect('login')
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

@login_required
def lista_pedidos(request):
    eh_gestor = request.user.tipo_usuario in ['GESTOR', 'CADISTA'] or request.user.is_superuser
    
    if eh_gestor:
        pedidos = Pedido.objects.all()
        lista_dentistas = Usuario.objects.filter(tipo_usuario='DENTISTA')
    else:
        pedidos = Pedido.objects.filter(dentista=request.user)
        lista_dentistas = [] 

    busca = request.GET.get('busca')
    if busca:
        pedidos = pedidos.filter(
            Q(id__icontains=busca) | 
            Q(nome_paciente__icontains=busca)
        )

    filtro_cliente = request.GET.get('cliente')
    if eh_gestor and filtro_cliente:
        pedidos = pedidos.filter(dentista__id=filtro_cliente)

    ordenar_por = request.GET.get('ordenar', '-id')
    
    mapa_ordem = {
        'id': 'id', '-id': '-id',
        'paciente': 'nome_paciente', '-paciente': '-nome_paciente',
        'data': 'data_entrega_prevista', '-data': '-data_entrega_prevista',
        'status': 'status',
    }
    campo_ordenacao = mapa_ordem.get(ordenar_por, '-id')
    pedidos = pedidos.order_by(campo_ordenacao)

    return render(request, 'pedidos/lista_pedidos.html', {
        'pedidos': pedidos,
        'dentistas': lista_dentistas,
        'eh_gestor': eh_gestor,
        'busca_atual': busca,
        'filtro_cliente_atual': filtro_cliente,
        'ordem_atual': ordenar_por
    })

@login_required
def excluir_pedido(request, id):
    pedido = get_object_or_404(Pedido, id=id)
    
    if not (request.user.tipo_usuario == 'GESTOR' or request.user.is_superuser):
        messages.error(request, 'Apenas gestores podem excluir registros.')
        return redirect('lista_pedidos')
        
    if request.method == 'POST':
        pedido.delete()
        messages.success(request, 'Pedido excluído.')
        return redirect('lista_pedidos')
    
    return render(request, 'pedidos/confirmar_exclusao.html', {'pedido': pedido})