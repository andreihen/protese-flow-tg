from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from pedidos import views
from pedidos.views import (
    novo_pedido, dashboard, editar_pedido, cadastrar, 
    lista_usuarios, editar_usuario, excluir_usuario, cadastrar,
    novo_pedido, dashboard, editar_pedido, meu_perfil, criar_usuario,
    lixeira_usuarios, restaurar_usuario, deletar_permanente, lista_aprovacao,
    aprovar_usuario, rejeitar_usuario, novo_pedido
)
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # --- Autenticação ---
    path('login/', auth_views.LoginView.as_view(template_name='pedidos/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('cadastrar/', views.cadastrar, name='cadastrar'),
    path('alterar-senha/', auth_views.PasswordChangeView.as_view(template_name='pedidos/alterar_senha.html', success_url='/alterar-senha/sucesso/'), name='password_change'),
    path('alterar-senha/sucesso/', auth_views.PasswordChangeDoneView.as_view(template_name='pedidos/alterar_senha_sucesso.html'), name='password_change_done'),

    # --- Fluxo Principal ---
    path('', views.dashboard, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('pedidos/', views.lista_pedidos, name='lista_pedidos'),
    
    # --- CRUD Pedidos ---
    path('pedidos/novo/', views.novo_pedido, name='criar_pedido'), # Nome padronizado
    path('pedidos/novo-pedido/', views.novo_pedido, name='novo_pedido'), # Alias para evitar erro
    path('pedidos/editar/<int:id>/', views.editar_pedido, name='editar_pedido'),
    path('pedidos/excluir/<int:id>/', views.excluir_pedido, name='excluir_pedido'),

    # --- Gestão de Usuários (Apenas Gestor) ---
    path('usuarios/', views.lista_usuarios, name='lista_usuarios'),
    path('usuarios/criar/', views.criar_usuario, name='criar_usuario'),
    path('usuarios/editar/<int:id>/', views.editar_usuario, name='editar_usuario'),
    path('usuarios/excluir/<int:id>/', views.excluir_usuario, name='excluir_usuario'),
    path('usuarios/lixeira/', views.lixeira_usuarios, name='lixeira_usuarios'),
    path('usuarios/restaurar/<int:id>/', views.restaurar_usuario, name='restaurar_usuario'),
    path('usuarios/deletar-permanente/<int:id>/', views.deletar_permanente, name='deletar_permanente'),
    
    # --- Aprovações e Perfil ---
    path('gestao/solicitacoes/', views.lista_aprovacao, name='lista_aprovacao'),
    path('gestao/aprovar/<int:user_id>/', views.aprovar_usuario, name='aprovar_usuario'),
    path('gestao/rejeitar/<int:user_id>/', views.rejeitar_usuario, name='rejeitar_usuario'),
    path('meu-perfil/', views.meu_perfil, name='meu_perfil'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)