from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from pedidos.api_views import PedidoViewSet, UsuarioViewSet, DiaExcecaoViewSet, ServicoViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

router = DefaultRouter()
router.register(r'pedidos', PedidoViewSet, basename='pedido')
router.register(r'usuarios', UsuarioViewSet, basename='usuario')
router.register(r'dia-excecao', DiaExcecaoViewSet, basename='dia-excecao')
router.register(r'servicos', ServicoViewSet, basename='servico')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # --- API ---
    path('api/', include(router.urls)),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)