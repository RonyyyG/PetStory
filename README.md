# 🐾 PetStory • Prontuário Unificado & Identificação Inteligente

Frontend moderno, responsivo e interativo desenvolvido em **HTML5**, **CSS3** e **JavaScript**, baseado na apresentação conceitual do **PetStory: HealthTech & Pet Care**.

---

## 📱 Telas Desenvolvidas

O projeto é estruturado em uma **Single Page Application (SPA)** de alta performance, permitindo alternar instantaneamente entre as 4 visões do ecossistema PetStory:

### 1. 🏥 Validação Veterinária & Leitor de Tag (`#vet-scan`)
- Interface clínica para o médico-veterinário (Dr. Ricardo Mendonça - CRMV-SP 38.412).
- **Leitor visual simulado de QR Code** com animação de laser holográfico e cantoneiras.
- Botão interativo **"Simular Leitura do QR Code"** e **"Simular Aproximação NFC"** que realizam a leitura e abrem o prontuário automaticamente.
- Campo de digitação manual para **Código da Tag** (Ex: `PST-9921`) ou **Microchip ISO 11784** com chips de preenchimento rápido.
- Botão de **Protocolo de Emergência Vital** (bypassa OTP com auditoria CRMV conforme LGPD).

### 2. 📋 Prontuário Médico Unificado Pós-QR Code (`#prontuario`)
- Cabeçalho do paciente canino **Thor (Golden Retriever)** com foto, dados cadastrais, peso ponderal, ID da tag e dados da tutora Mariana.
- **Banner de Gestão Clínica Crítica & Restrições Anestésicas (Destaque em Vermelho/Âmbar com pulso)**:
  - Alergia severa: Dipirona e Sulfas (choque anafilático prévio).
  - Restrição anestésica: Bradicardia por Alfa-2 agonistas.
  - Condição crônica: Dermatite atópica.
- **Abas Clínicas Interativas**:
  - **Visão Geral & Vitais**: Frequência cardíaca (88 bpm), respiratória (22 mpm), temperatura (38.4°C), escore corporal (5/9) e linha do tempo histórica com atendimentos de diferentes clínicas.
  - **Prevenção & Sanitário**: Carteira com V10 (Zoetis), Antirrábica, Giárdia, Bronchi-Shield, LeishTec, Simparic e Drontal Plus.
  - **Prescrições & Tratamentos**: Medicamentos contínuos (Apoquel 16mg) e tópicos com posologia detalhada.
  - **Procedimentos & Cirurgias**: Registro cirúrgico de castração e suturas com relatórios.
  - **Laudos & Exames**: Hemograma, Ultrassonografia Abdominal e Raio-X Coxofemoral com visualizadores.
  - **Nova Evolução Clínica**: Formulário para o veterinário redigir nova anamnese e assinar digitalmente.

### 3. 🐾 Portal do Dono do Pet / Tutor (`#tutor`)
- Experiência visual para a tutora Mariana.
- Botão em destaque: **[🔑 Gerar Código OTP para o Veterinário]** — abre um modal com token temporário de 6 dígitos (`849 201`) e contagem regressiva de 60s.
- **Carteirinha Digital de Vacinas**: visual em cards com status "Aplicada", datas de reforço e exportação em PDF.
- **Alergias & Cuidados Especiais**: cartões de alerta para medicações proibidas e restrições alimentares.
- **Widget da Coleira Inteligente**: status do chip NFC, última leitura e **Switch interativo do "Modo Pet Perdido"**.
- Próximos lembretes preventivos (Simparic e Reforço V10).

### 4. 🏷️ Tag Pública da Coleira (`#public-tag`)
- Visão de emergência aberta por qualquer pessoa que escanear a medalha de um animal na rua.
- Alerta médico resumido: orienta a não alimentar o cão e entrar em contato.
- Ações com 1 toque:
  - 🟢 **Chamar Tutora no WhatsApp**
  - 📞 **Ligar para Contato de Emergência**
  - 📍 **Enviar Minha Localização GPS Atual**
- Selo de conformidade LGPD (dados residenciais e clínicos confidenciais preservados).

---

## 🕵️‍♂️ O "Botão Bem Escondido" (Alternador de Telas)

No canto inferior direito de qualquer tela, há uma cápsula flutuante discreta:
- **`Alternar Telas`** com indicador verde.
- Ao clicar, expande o painel para navegar diretamente entre qualquer uma das 4 telas.

### ⌨️ Atalhos Rápidos pelo Teclado:
Você também pode pressionar as teclas numéricas no teclado (quando não estiver digitando em um campo):
- Pressione **`1`**: Tela 1 (Leitor de QR / Código do Veterinário)
- Pressione **`2`**: Tela 2 (Prontuário Completo do Pet)
- Pressione **`3`**: Tela 3 (Portal do Tutor / Carteirinha)
- Pressione **`4`**: Tela 4 (Tag Pública da Coleira / Pet Perdido)
- Pressione **`Esc`**: Fecha o modal ou menu flutuante

---

## 🚀 Como Executar

Basta abrir o arquivo `index.html` diretamente em qualquer navegador moderno (Chrome, Edge, Safari, Firefox), ou iniciar um servidor local via terminal:

```bash
# Com Python 3
python -m http.server 3000
```
Em seguida, acesse no navegador: `http://localhost:3000`

---

## 🎨 Paleta e Tecnologias
- **Tema Branco Clínico (Medical Clean White)**: Fundo claro e limpo (`#f8fafc` / `#ffffff`), tipografia de alto contraste em ardósia escura (`#0f172a`), realces em verde clínico/esmeralda (`#00a887`) e bordas suaves, projetado especificamente para a rotina diária e rápida de médicos-veterinários, recepções de clínicas e petshops.
- **HTML5 Semântico**: Arquitetura modular e acessível.
- **CSS3 Moderno**: Variáveis CSS, cards elevados com sombras suaves, Flexbox, CSS Grid, tipografia fluida.
- **JavaScript Vanilla**: Sem dependências pesadas, ultra rápido e responsivo.
- **Fontes**: *Plus Jakarta Sans* e *Outfit*.
- **Ícones**: *Font Awesome 6.5.1*.
