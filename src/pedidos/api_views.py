from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import transaction
from django.db.models import Q
import json
from .models import Pedido, Usuario, Anexo, Historico_Pedidos, Configuracao, DiaExcecao, Servico
from .serializers import PedidoSerializer, UsuarioSerializer, HistoricoPedidoSerializer, ConfiguracaoSerializer, DiaExcecaoSerializer, ServicoSerializer

def format_friendly_value(field, value):
    if value is None or str(value).strip() in ['', '{}', '[]', 'None']:
        return "Nenhum"
    
    if field == 'urgente':
        return "Sim" if value else "Não"
        
    if field == 'sexo':
        if value == 'M':
            return "Masculino"
        elif value == 'F':
            return "Feminino"
        return str(value)
        
    if field in ['elementos', 'dentes']:
        if isinstance(value, str):
            try:
                val_json = json.loads(value)
                if isinstance(val_json, dict) and val_json:
                    formatted = [f"Dente {tooth} ({srv})" for tooth, srv in val_json.items()]
                    return ", ".join(formatted)
            except Exception:
                pass
        return str(value)
        
    if field == 'componentes_implante':
        if isinstance(value, str):
            try:
                val_json = json.loads(value)
                if isinstance(val_json, list) and val_json:
                    items = []
                    for comp in val_json:
                        dentes = ", ".join(str(d) for d in comp.get('dentes', []))
                        modelo = str(comp.get('marcaModelo', '')).strip()
                        if dentes and modelo:
                            items.append(f"{modelo} (Dentes: {dentes})")
                        elif modelo:
                            items.append(modelo)
                        elif dentes:
                            items.append(f"Dentes: {dentes}")
                    if items:
                        return "; ".join(items)
            except Exception:
                pass
        return str(value)
        
    return str(value)

def compute_elements_diff(old_json_str, new_json_str):
    def parse_dict(val):
        if not val or not isinstance(val, str):
            return {}
        try:
            res = json.loads(val)
            return res if isinstance(res, dict) else {}
        except Exception:
            return {}

    def clean_srv(srv):
        if isinstance(srv, list):
            return ", ".join(str(x) for x in srv)
        if isinstance(srv, str):
            s = srv.strip()
            if s.startswith('[') and s.endswith(']'):
                try:
                    p = json.loads(s)
                    if isinstance(p, list):
                        return ", ".join(str(x) for x in p)
                except Exception:
                    pass
        return str(srv)

    old_dict = parse_dict(old_json_str)
    new_dict = parse_dict(new_json_str)

    diffs = []
    
    # Removed items
    for tooth, srv in old_dict.items():
        if tooth not in new_dict:
            diffs.append(f"- Dente {tooth}: {clean_srv(srv)}")

    # Added items
    for tooth, srv in new_dict.items():
        if tooth not in old_dict:
            diffs.append(f"+ Dente {tooth}: {clean_srv(srv)}")

    # Modified items
    for tooth, old_srv in old_dict.items():
        if tooth in new_dict and old_srv != new_dict[tooth]:
            c_old = clean_srv(old_srv)
            c_new = clean_srv(new_dict[tooth])
            if c_old != c_new:
                diffs.append(f"Dente {tooth}: {c_old} ➔ {c_new}")

    return diffs

def check_concurrency(pedido, request):
    client_updated_at = request.data.get('updated_at')
    if client_updated_at:
        try:
            client_time = parse_datetime(client_updated_at)
            if client_time:
                if timezone.is_naive(client_time):
                    client_time = timezone.make_aware(client_time, timezone.get_current_timezone())
                if timezone.is_aware(pedido.updated_at):
                    client_time = client_time.astimezone(pedido.updated_at.tzinfo)
                # Permitir margem de tolerância de 5 segundos para diferenças no timestamp do cliente
                if (pedido.updated_at - client_time).total_seconds() > 5:
                    return False
        except Exception as e:
            print("Erro de concorrência:", e)
    return True

def registrar_historico(pedido, usuario, status_anterior, status_novo, motivo=None, detalhes_alteracao=None):
    Historico_Pedidos.objects.create(
        pedido=pedido,
        usuario=usuario,
        status_anterior=status_anterior,
        status_novo=status_novo,
        motivo_retrabalho=motivo,
        detalhes_alteracao=detalhes_alteracao
    )

def calcular_prazo_horas_uteis(start_dt, hours_to_add, inicio_h, fim_h):
    from datetime import timedelta
    
    current_dt = start_dt
    
    def is_working_day(dt):
        from .models import DiaExcecao
        date_only = dt.date()
        exc = DiaExcecao.objects.filter(data=date_only).first()
        if exc is not None:
            return exc.trabalha
        return dt.weekday() < 5
        
    def adjust_to_business_hours(dt):
        while True:
            if not is_working_day(dt):
                dt = dt + timedelta(days=1)
                dt = dt.replace(hour=inicio_h.hour, minute=inicio_h.minute, second=0, microsecond=0)
                continue
            
            dt_time = dt.time()
            if dt_time < inicio_h:
                dt = dt.replace(hour=inicio_h.hour, minute=inicio_h.minute, second=0, microsecond=0)
                break
            elif dt_time >= fim_h:
                dt = dt + timedelta(days=1)
                dt = dt.replace(hour=inicio_h.hour, minute=inicio_h.minute, second=0, microsecond=0)
                continue
            else:
                break
        return dt

    current_dt = adjust_to_business_hours(current_dt)
    
    workday_seconds = (fim_h.hour * 3600 + fim_h.minute * 60) - (inicio_h.hour * 3600 + inicio_h.minute * 60)
    if workday_seconds <= 0:
        workday_seconds = 10 * 3600
        
    remaining_seconds = int(hours_to_add * 3600)
    
    while remaining_seconds > 0:
        current_dt = adjust_to_business_hours(current_dt)
        dt_end = current_dt.replace(hour=fim_h.hour, minute=fim_h.minute, second=0, microsecond=0)
        seconds_available_today = int((dt_end - current_dt).total_seconds())
        
        if seconds_available_today >= remaining_seconds:
            current_dt += timedelta(seconds=remaining_seconds)
            remaining_seconds = 0
        else:
            remaining_seconds -= seconds_available_today
            current_dt = current_dt + timedelta(days=1)
            current_dt = current_dt.replace(hour=inicio_h.hour, minute=inicio_h.minute, second=0, microsecond=0)
            
    return current_dt

class PedidoViewSet(viewsets.ModelViewSet):
    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'GESTOR' or user.is_superuser:
            return Pedido.objects.all().order_by('-urgente', '-data_criacao')
        elif user.role == 'OPERADOR':
            return Pedido.objects.filter(
                Q(operador=user) | Q(status='PENDENTE') | Q(status='INICIADO') | Q(status='RETRABALHO_OPERADOR')
            ).order_by('-urgente', '-data_criacao')
        else: # DENTISTA
            return Pedido.objects.filter(dentista=user).order_by('-urgente', '-data_criacao')

    @transaction.atomic
    def perform_create(self, serializer):
        config = Configuracao.get_solo()
        inicio_h = config.inicio_expediente
        fim_h = config.fim_expediente
        
        is_urgente = serializer.validated_data.get('urgente', False)
        if is_urgente:
            horas_a_adicionar = config.prazo_urgencia
        else:
            horas_a_adicionar = (fim_h.hour + fim_h.minute / 60.0) - (inicio_h.hour + inicio_h.minute / 60.0)
            if horas_a_adicionar <= 0:
                horas_a_adicionar = 10.0

        prazo_calculado = calcular_prazo_horas_uteis(timezone.now(), horas_a_adicionar, inicio_h, fim_h)
        
        pedido = serializer.save(dentista=self.request.user, status='PENDENTE', prazo_original=prazo_calculado)
        
        # Build friendly initial creation snapshot
        snapshot_lines = [
            f"Paciente: {pedido.nome_paciente}",
            f"Sexo: {format_friendly_value('sexo', pedido.sexo)}",
            f"Tipo de Serviço: {pedido.tipo_servico}"
        ]
        if pedido.cor:
            snapshot_lines.append(f"Cor: {pedido.cor}")
            
        snapshot_lines.append(f"Urgente: {format_friendly_value('urgente', pedido.urgente)}")
        
        elem_str = format_friendly_value('elementos', pedido.elementos)
        if elem_str != "Nenhum":
            snapshot_lines.append(f"Elementos: {elem_str}")
        elif pedido.dentes:
            snapshot_lines.append(f"Dentes: {pedido.dentes}")
            
        comp_str = format_friendly_value('componentes_implante', pedido.componentes_implante)
        if comp_str != "Nenhum":
            snapshot_lines.append(f"Componentes de Implante: {comp_str}")
            
        if pedido.observacoes:
            snapshot_lines.append(f"Observações: {pedido.observacoes}")
            
        detalhes_criacao = "Estado Inicial no Cadastro:\n" + "\n".join([f"• {line}" for line in snapshot_lines])
        registrar_historico(pedido, self.request.user, None, 'PENDENTE', detalhes_alteracao=detalhes_criacao)

    @transaction.atomic
    def perform_update(self, serializer):
        pedido = self.get_object()
        if not check_concurrency(pedido, self.request):
            from rest_framework.exceptions import APIException
            from rest_framework import status
            class ConcurrencyConflict(APIException):
                status_code = status.HTTP_409_CONFLICT
                default_detail = 'Este caso foi modificado por outro usuário.'
            raise ConcurrencyConflict()

        if pedido.status not in ['PENDENTE', 'RETRABALHO_CLIENTE']:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Apenas casos em status Pendente ou Retrabalho ao Cliente podem ser alterados.")

        # Detect changes before saving
        alteracoes = []

        # 1. Compute granular diffs for elementos (service additions, removals, modifications)
        old_elem_str = getattr(pedido, 'elementos', '{}')
        new_elem_str = serializer.validated_data.get('elementos', old_elem_str)
        elem_diffs = compute_elements_diff(old_elem_str, new_elem_str)
        alteracoes.extend(elem_diffs)

        # 2. Check other fields
        other_fields = [
            ('nome_paciente', 'Nome do Paciente'),
            ('sexo', 'Sexo'),
            ('tipo_servico', 'Tipo de Serviço'),
            ('cor', 'Cor'),
            ('urgente', 'Urgência'),
            ('componentes_implante', 'Componentes de Implante'),
            ('observacoes', 'Observações')
        ]

        for field, label in other_fields:
            old_val = getattr(pedido, field)
            new_val = serializer.validated_data.get(field, old_val)

            if field == 'urgente':
                if old_val != new_val:
                    alteracoes.append("Urgência: Sim" if new_val else "Urgência: Não")
            elif field == 'sexo':
                if old_val != new_val:
                    old_str = "Masculino" if old_val == 'M' else "Feminino" if old_val == 'F' else str(old_val)
                    new_str = "Masculino" if new_val == 'M' else "Feminino" if new_val == 'F' else str(new_val)
                    alteracoes.append(f"Sexo: {old_str} ➔ {new_str}")
            elif field == 'componentes_implante':
                old_comp = format_friendly_value('componentes_implante', old_val)
                new_comp = format_friendly_value('componentes_implante', new_val)
                if old_comp != new_comp:
                    if old_comp == "Nenhum":
                        alteracoes.append(f"+ Componente Implante: {new_comp}")
                    elif new_comp == "Nenhum":
                        alteracoes.append(f"- Componente Implante: {old_comp}")
                    else:
                        alteracoes.append(f"Componente Implante: {old_comp} ➔ {new_comp}")
            else:
                old_str = format_friendly_value(field, old_val).strip()
                new_str = format_friendly_value(field, new_val).strip()
                if old_str != new_str and not (old_str == "Nenhum" and new_str == "Nenhum"):
                    if old_str == "Nenhum":
                        alteracoes.append(f"{label}: {new_str}")
                    elif new_str == "Nenhum":
                        alteracoes.append(f"{label}: [removido]")
                    else:
                        alteracoes.append(f"{label}: {old_str} ➔ {new_str}")

        status_anterior = pedido.status
        status_novo = 'PENDENTE' if status_anterior == 'RETRABALHO_CLIENTE' else status_anterior

        # Recalculate delivery deadline as if submitted right now
        config = Configuracao.get_solo()
        inicio_h = config.inicio_expediente
        fim_h = config.fim_expediente
        
        is_urgente = serializer.validated_data.get('urgente', pedido.urgente)
        if is_urgente:
            horas_a_adicionar = config.prazo_urgencia
        else:
            horas_a_adicionar = (fim_h.hour + fim_h.minute / 60.0) - (inicio_h.hour + inicio_h.minute / 60.0)
            if horas_a_adicionar <= 0:
                horas_a_adicionar = 10.0

        novo_prazo = calcular_prazo_horas_uteis(timezone.now(), horas_a_adicionar, inicio_h, fim_h)

        pedido = serializer.save(status=status_novo, prazo_ajustado=novo_prazo)
        
        detalhes = "Edições realizadas:\n" + "\n".join([f"• {alt}" for alt in alteracoes]) if alteracoes else "Nenhuma alteração nos dados cadastrais."
        motivo = "Caso atualizado/corrigido pelo cliente" if status_anterior != status_novo else None
        
        registrar_historico(pedido, self.request.user, status_anterior, status_novo, motivo=motivo, detalhes_alteracao=detalhes)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def atribuir_operador(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado desde a sua última leitura.'}, status=status.HTTP_409_CONFLICT)
            
        operador_id = request.data.get('operador_id')
        if not operador_id:
             return Response({'error': 'Operador não informado.'}, status=status.HTTP_400_BAD_REQUEST)
        
        operador = Usuario.objects.filter(id=operador_id).first()
        status_anterior = pedido.status
        pedido.operador = operador
        # Only change status if it was not already initiated
        if pedido.status == 'PENDENTE':
            pedido.status = 'PENDENTE' # Keep it pending but with an operator assigned
        pedido.save()
        registrar_historico(pedido, request.user, status_anterior, 'PENDENTE')
        return Response({'status': 'Atribuído ao operador'})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def iniciar_producao(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado desde a sua última leitura.'}, status=status.HTTP_409_CONFLICT)
            
        status_anterior = pedido.status
        if not pedido.operador and request.user.role in ['OPERADOR', 'GESTOR', 'ADMIN']:
            pedido.operador = request.user

        pedido.status = 'INICIADO'
        pedido.save()
        registrar_historico(pedido, request.user, status_anterior, 'INICIADO')
        return Response({'status': 'Produção iniciada'})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def finalizar_caso(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado desde a sua última leitura.'}, status=status.HTTP_409_CONFLICT)
            
        arquivo = request.FILES.get('arquivo_entregavel')
        if not arquivo and not pedido.arquivo_entregavel:
            return Response({'error': 'Arquivo entregável (.STL/.PLY) é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
        
        status_anterior = pedido.status
        if arquivo:
            pedido.arquivo_entregavel = arquivo

        if not pedido.operador and request.user.role in ['OPERADOR', 'GESTOR', 'ADMIN']:
            pedido.operador = request.user

        pedido.status = 'EM_APROVACAO'
        pedido.data_conclusao = timezone.now()
        pedido.save()
        registrar_historico(pedido, request.user, status_anterior, 'EM_APROVACAO')
        return Response({'status': 'Caso enviado para aprovação'})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def solicitar_retrabalho(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado.'}, status=status.HTTP_409_CONFLICT)
            
        motivo = request.data.get('motivo_retrabalho')
        if not motivo:
            return Response({'error': 'Motivo do retrabalho é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
            
        status_anterior = pedido.status
        pedido.status = 'RETRABALHO_OPERADOR'
        pedido.save()
        registrar_historico(pedido, request.user, status_anterior, 'RETRABALHO_OPERADOR', motivo)
        return Response({'status': 'Retrabalho solicitado ao operador'})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def solicitar_retrabalho_cliente(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado.'}, status=status.HTTP_409_CONFLICT)
            
        motivo = request.data.get('motivo_retrabalho')
        if not motivo:
            return Response({'error': 'Motivo do retrabalho é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
            
        status_anterior = pedido.status
        pedido.status = 'RETRABALHO_CLIENTE'
        pedido.save()
        registrar_historico(pedido, request.user, status_anterior, 'RETRABALHO_CLIENTE', motivo)
        return Response({'status': 'Retrabalho solicitado ao cliente'})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def aprovar_caso(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado.'}, status=status.HTTP_409_CONFLICT)
            
        status_anterior = pedido.status
        pedido.status = 'FINALIZADO'
        pedido.save()
        registrar_historico(pedido, request.user, status_anterior, 'FINALIZADO')
        return Response({'status': 'Caso aprovado'})

    @action(detail=True, methods=['post'])
    def upload_anexo(self, request, pk=None):
        pedido = self.get_object()
        arquivo = request.FILES.get('arquivo')
        descricao = request.data.get('descricao', 'Arquivo STL')
        if not arquivo:
            return Response({'error': 'Nenhum arquivo enviado.'}, status=status.HTTP_400_BAD_REQUEST)
        anexo = Anexo.objects.create(pedido=pedido, arquivo=arquivo, descricao=descricao)
        return Response({'status': 'Anexo enviado', 'id': anexo.id})

    @action(detail=True, methods=['post'])
    def remover_anexo(self, request, pk=None):
        pedido = self.get_object()
        anexo_id = request.data.get('anexo_id')
        if not anexo_id:
            return Response({'error': 'ID do anexo não informado.'}, status=status.HTTP_400_BAD_REQUEST)
        anexo = Anexo.objects.filter(pedido=pedido, id=anexo_id).first()
        if not anexo:
            return Response({'error': 'Anexo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        
        if pedido.status not in ['PENDENTE', 'RETRABALHO_CLIENTE']:
            return Response({'error': 'Não é permitido alterar anexos de casos em andamento.'}, status=status.HTTP_403_FORBIDDEN)
            
        anexo.delete()
        return Response({'status': 'Anexo removido'})


    @action(detail=True, methods=['post'])
    @transaction.atomic
    def alternar_urgencia(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado.'}, status=status.HTTP_409_CONFLICT)
        
        config = Configuracao.get_solo()
        inicio_h = config.inicio_expediente
        fim_h = config.fim_expediente
        
        pedido.urgente = not pedido.urgente
        
        if pedido.urgente:
            horas_a_adicionar = config.prazo_urgencia
        else:
            horas_a_adicionar = (fim_h.hour + fim_h.minute / 60.0) - (inicio_h.hour + inicio_h.minute / 60.0)
            if horas_a_adicionar <= 0:
                horas_a_adicionar = 10.0
                
        # Recalculate from now
        novo_prazo = calcular_prazo_horas_uteis(timezone.now(), horas_a_adicionar, inicio_h, fim_h)
        pedido.prazo_ajustado = novo_prazo
        
        pedido.save()
        status_atual = pedido.status
        acao = "Urgência ativada" if pedido.urgente else "Urgência desativada"
        registrar_historico(pedido, request.user, status_atual, status_atual, motivo=acao)
        return Response({'status': acao, 'urgente': pedido.urgente, 'updated_at': pedido.updated_at})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancelar_caso(self, request, pk=None):
        pedido = self.get_object()
        if not check_concurrency(pedido, request):
            return Response({'error': 'Este caso foi modificado.'}, status=status.HTTP_409_CONFLICT)
            
        # Apenas o dentista proprietário, gestores ou superusers podem cancelar o caso
        if request.user != pedido.dentista and request.user.role != 'GESTOR' and not request.user.is_superuser:
            return Response({'error': 'Você não tem permissão para cancelar este caso.'}, status=status.HTTP_403_FORBIDDEN)
            
        if pedido.status in ['FINALIZADO', 'CANCELADO']:
            return Response({'error': 'Casos finalizados ou já cancelados não podem ser cancelados.'}, status=status.HTTP_400_BAD_REQUEST)
            
        status_anterior = pedido.status
        pedido.status = 'CANCELADO'
        pedido.save()
        
        registrar_historico(pedido, request.user, status_anterior, 'CANCELADO', detalhes_alteracao="Caso cancelado pelo usuário.")
        return Response({'status': 'Caso cancelado com sucesso.'})

    @action(detail=False, methods=['get', 'post'], url_path='configuracao')
    def gerenciar_configuracao(self, request):
        config = Configuracao.get_solo()
        if request.method == 'POST':
            if request.user.role != 'GESTOR' and not request.user.is_superuser:
                return Response({'error': 'Apenas gestores podem alterar as configurações.'}, status=status.HTTP_403_FORBIDDEN)
                
            serializer = ConfiguracaoSerializer(config, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ConfiguracaoSerializer(config)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def historico(self, request, pk=None):
        pedido = self.get_object()
        historico = Historico_Pedidos.objects.filter(pedido=pedido)
        serializer = HistoricoPedidoSerializer(historico, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def download_zip(self, request, pk=None):
        import io
        import zipfile
        from django.http import HttpResponse

        pedido = self.get_object()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for anexo in pedido.anexos.all():
                if anexo.arquivo and hasattr(anexo.arquivo, 'path'):
                    try:
                        filename = f"anexos/{anexo.arquivo.name.split('/')[-1]}"
                        zip_file.write(anexo.arquivo.path, filename)
                    except Exception:
                        pass
            if pedido.arquivo_entregavel and hasattr(pedido.arquivo_entregavel, 'path'):
                try:
                    filename = f"entregavel/{pedido.arquivo_entregavel.name.split('/')[-1]}"
                    zip_file.write(pedido.arquivo_entregavel.path, filename)
                except Exception:
                    pass

        buffer.seek(0)
        zip_filename = f"pedido_{pedido.id}_{pedido.nome_paciente.replace(' ', '_')}.zip"
        response = HttpResponse(buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        return response

class UsuarioViewSet(viewsets.ModelViewSet):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'GESTOR' or user.is_superuser:
            return Usuario.objects.all().order_by('username')
        return Usuario.objects.filter(id=user.id)

    def check_gestor_permission(self):
        user = self.request.user
        if user.role != 'GESTOR' and user.role != 'ADMIN' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Apenas gestores ou administradores podem gerenciar usuários.")

    def create(self, request, *args, **kwargs):
        self.check_gestor_permission()
        return super().create(request, *args, **kwargs)

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        if instance.id != user.id:
            self.check_gestor_permission()
        
        # Garantir que usuários comuns não alterem campos administrativos do seu próprio perfil
        if user.role != 'GESTOR' and user.role != 'ADMIN' and not user.is_superuser:
            for field in ['role', 'is_active', 'cadastro_confirmado', 'is_superuser', 'username']:
                serializer.validated_data.pop(field, None)
                
        super().perform_update(serializer)


    def perform_destroy(self, instance):
        self.check_gestor_permission()
        super().perform_destroy(instance)

    @action(detail=True, methods=['post'])
    def alternar_confirmacao(self, request, pk=None):
        self.check_gestor_permission()
        usuario = self.get_object()
        usuario.cadastro_confirmado = not usuario.cadastro_confirmado
        usuario.save()
        return Response({
            'status': 'Status de confirmação atualizado',
            'cadastro_confirmado': usuario.cadastro_confirmado
        })

class DiaExcecaoViewSet(viewsets.ModelViewSet):
    serializer_class = DiaExcecaoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DiaExcecao.objects.all().order_by('data')

    def perform_create(self, serializer):
        if self.request.user.role != 'GESTOR' and not self.request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Apenas gestores podem alterar o calendário de exceções.")
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role != 'GESTOR' and not self.request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Apenas gestores podem alterar o calendário de exceções.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'GESTOR' and not self.request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Apenas gestores podem alterar o calendário de exceções.")
        instance.delete()

class ServicoViewSet(viewsets.ModelViewSet):
    serializer_class = ServicoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        ativo = self.request.query_params.get('ativo', None)
        queryset = Servico.objects.all().order_by('nome')
        if ativo is not None:
            is_ativo = ativo.lower() == 'true'
            queryset = queryset.filter(ativo=is_ativo)
        return queryset

    def check_gestor_permission(self):
        user = self.request.user
        if user.role != 'GESTOR' and user.role != 'ADMIN' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Apenas gestores ou administradores podem gerenciar serviços.")

    def perform_create(self, serializer):
        self.check_gestor_permission()
        serializer.save()

    def perform_update(self, serializer):
        self.check_gestor_permission()
        serializer.save()

    def perform_destroy(self, instance):
        self.check_gestor_permission()
        
        # Em vez de deletar fisicamente, vamos apenas inativar (Soft Delete) 
        # para não quebrar pedidos antigos caso tenha dependência no futuro.
        instance.ativo = False
        instance.save()

