# 🦷 ProteseFlow - Sistema de Gestão de Próteses Dentárias

Este projeto é um Trabalho de Graduação (TG) desenvolvido para o curso de [Seu Curso] da FATEC. O objetivo é otimizar o fluxo de solicitação e acompanhamento de próteses dentárias entre Dentistas e Laboratórios.

## 🚀 Funcionalidades
- **Painel do Dentista:** Envio de pedidos, upload de arquivos STL/PLY e acompanhamento de status.
- **Painel do Gestor:** Visualização de fila de produção, download de ativos e alteração de status.
- **Segurança:** Validação de cadastro (CRO) e permissões de acesso baseadas em perfil.

## 🛠 Tecnologias
- Python 3.12
- Django 5.0
- Bootstrap 5
- SQLite (Banco de Dados)

## 📦 Como rodar este projeto

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/SEU_USUARIO/protese-flow-tg.git](https://github.com/SEU_USUARIO/protese-flow-tg.git)

2. **Crie e ative o ambiente virtual:**
   ```bash
    python -m venv venv
    # Windows:
    .\venv\Scripts\activate
    # Linux/Mac:
    source venv/bin/activate

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt

4. **Prepare o Banco de Dados**:
   ```bash
    cd src
    python manage.py migrate
    python manage.py createsuperuser

5. **Rode o servidor**:
   ```bash
   python manage.py runserver