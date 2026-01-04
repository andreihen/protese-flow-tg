from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from pedidos.views import (
    novo_pedido, dashboard, editar_pedido, cadastrar, 
    lista_usuarios, editar_usuario, excluir_usuario, cadastrar,
    novo_pedido, dashboard, editar_pedido, meu_perfil
)
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('novo-pedido/', novo_pedido, name='novo_pedido'),
    path('dashboard/', dashboard, name='dashboard'),
    path('pedido/<int:id>/', editar_pedido, name='editar_pedido'),
    path('', dashboard, name='home'),
    path('login/', auth_views.LoginView.as_view(template_name='pedidos/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('cadastrar/', cadastrar, name='cadastrar'),
    path('usuarios/', lista_usuarios, name='lista_usuarios'),
    path('usuarios/editar/<int:id>/', editar_usuario, name='editar_usuario'),
    path('usuarios/excluir/<int:id>/', excluir_usuario, name='excluir_usuario'),
    path('meu-perfil/', meu_perfil, name='meu_perfil'),

    path('alterar-senha/', 
         auth_views.PasswordChangeView.as_view(
             template_name='pedidos/alterar_senha.html',
             success_url='/alterar-senha/sucesso/'
         ), 
         name='password_change'),

    path('alterar-senha/sucesso/', 
         auth_views.PasswordChangeDoneView.as_view(
             template_name='pedidos/alterar_senha_sucesso.html'
         ), 
         name='password_change_done'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)