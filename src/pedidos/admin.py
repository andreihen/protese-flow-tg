from django.contrib import admin
from .models import Usuario, Pedido, Anexo

admin.site.register(Usuario)
admin.site.register(Pedido)
admin.site.register(Anexo)