from rest_framework import serializers
from .models import Usuario, Pedido, Anexo, Historico_Pedidos, Configuracao, DiaExcecao, Servico

class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'password', 'role', 'telefone', 'cro', 'is_active', 'cadastro_confirmado', 'first_name', 'is_superuser']
        read_only_fields = ['is_superuser']

    def validate(self, data):
        role = data.get('role')
        if role == 'DENTISTA' and not data.get('cro'):
            raise serializers.ValidationError({'cro': 'O registro do CRO é obrigatório para criar contas de dentistas.'})
        return data

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = Usuario(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        
        user.cadastro_confirmado = True
        if user.role == 'ADMIN':
            user.is_superuser = True
            user.is_staff = True
        user.save()
        return user

    def update(self, instance, validated_data):
        # Garantir que a role nunca seja alterada após a criação
        validated_data.pop('role', None)
        
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
        return super().update(instance, validated_data)

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'

class AnexoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Anexo
        fields = '__all__'
        read_only_fields = ['pedido', 'uploaded_at']

class HistoricoPedidoSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.SerializerMethodField()

    def get_usuario_nome(self, obj):
        if obj.usuario:
            if obj.usuario.first_name:
                return obj.usuario.first_name
            return obj.usuario.username
        return "Sistema"
    
    class Meta:
        model = Historico_Pedidos
        fields = '__all__'

class PedidoSerializer(serializers.ModelSerializer):
    anexos = AnexoSerializer(many=True, read_only=True)
    dentista_nome = serializers.SerializerMethodField()
    operador_nome = serializers.SerializerMethodField()

    def get_dentista_nome(self, obj):
        if obj.dentista.first_name:
            return obj.dentista.first_name
        return obj.dentista.username

    def get_operador_nome(self, obj):
        if obj.operador:
            if obj.operador.first_name:
                return obj.operador.first_name
            return obj.operador.username
        return None


    class Meta:
        model = Pedido
        fields = '__all__'
        read_only_fields = ['dentista', 'data_criacao', 'data_conclusao', 'status', 'operador', 'updated_at', 'prazo_original', 'prazo_ajustado']

class ConfiguracaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Configuracao
        fields = ['inicio_expediente', 'fim_expediente', 'prazo_urgencia']

class DiaExcecaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiaExcecao
        fields = '__all__'

