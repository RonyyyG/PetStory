# 🐾 PetStory • HealthTech & Pet Care
### Prontuário Veterinário Unificado, Identificação Inteligente com Tags NFC/QR Code e Gestão Clínica Auditada

[![Java 21 LTS](https://img.shields.io/badge/Java-21%20LTS-orange.svg)](https://www.oracle.com/java/)
[![Maven](https://img.shields.io/badge/Build-Maven%203.8+-blue.svg)](https://maven.apache.org/)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-green.svg)](https://supabase.com/)
[![Architecture](https://img.shields.io/badge/Architecture-Virtual%20Threads%20%2B%20SPA-teal.svg)]()
[![Tests](https://img.shields.io/badge/Tests-27%20Passed%20(100%25)-brightgreen.svg)]()
[![Compliance](https://img.shields.io/badge/Compliance-CFMV%20%26%20LGPD-blueviolet.svg)]()

---

## 📌 1. Visão Geral do Projeto

O **PetStory** é um ecossistema completo de saúde e identificação animal projetado para resolver a fragmentação do histórico médico de cães e gatos. Na rotina tradicional, tutores perdem carteirinhas de vacinação em papel e clínicas veterinárias não possuem acesso aos exames e procedimentos realizados em outros hospitais.

Com o **PetStory**, cada animal possui uma **Medalha Inteligente (Tag PST)** com sensor NFC e QR Code unificado:
1. **O Tutor** gera um token temporário de 6 dígitos (**Código OTP**) com validade de 2 horas.
2. **O Médico-Veterinário** aponta a câmera para o QR Code da medalha (ou aproxima via NFC), insere o OTP do tutor e acessa instantaneamente o **Prontuário Médico Unificado**.
3. **Em Casos de Emergência Vital**, o veterinário pode acionar o protocolo de emergência imediata sem OTP, com registro auditado obrigatório de seu CRMV conforme os padrões do **CFMV** e da **LGPD**.
4. **Qualquer Pessoa** que encontrar um animal perdido na rua pode ler a medalha com a câmera do celular e acessar o **Perfil Público**, acionando o tutor via WhatsApp ou Ligação telefônica em 1 toque, sem expor dados confidenciais do dono.

---

## 🏗️ 2. Arquitetura Técnica do Sistema

O projeto adota uma arquitetura fullstack robusta, moderna e de altíssima performance:

```
                    ┌──────────────────────────────────────────────┐
                    │               CLIENTE / FRONTEND             │
                    │   HTML5 • CSS3 Glassmorphism • JS Vanilla    │
                    │   html5-qrcode (Câmera) • Web Audio API      │
                    └──────────────────────┬───────────────────────┘
                                           │
                        Requisições REST   │  (JSON / TLS)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │             BACKEND HTTP SERVER              │
                    │   Java 21 LTS Puro (com.sun.net.httpserver)  │
                    │   Virtual Threads (ThreadPerTaskExecutor)    │
                    │   Criptografia SHA-256 com Salt de Domínio   │
                    └──────────────────────┬───────────────────────┘
                                           │
                     PostgreSQL REST API   │  (Criptografia TLS 1.3)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │            BANCO DE DADOS EM NUVEM           │
                    │              Supabase PostgreSQL             │
                    │  10 Tabelas Relacionais com RLS e Auditoria  │
                    └──────────────────────────────────────────────┘
```

* **Frontend SPA (Single Page Application)**: Desenvolvido em HTML5 semântico, CSS3 moderno com tema *Medical Clean White* e JavaScript Vanilla ES6+ desacoplado em módulos independentes (`auth.js`, `tutor.js`, `veterinario.js`, `pdf.js`, `config.js`).
* **Leitor de Câmera Real**: Integração com a biblioteca `html5-qrcode` para varredura em tempo real por webcams e smartphones, com feedback sonoro sintetizado em tempo de execução via **Web Audio API** nativa (sem arquivos `.mp3` externos).
* **Backend Java 21 LTS Puro**: Servidor HTTP modular de alta concorrência utilizando **Virtual Threads** do Projeto Loom (`Executors.newVirtualThreadPerTaskExecutor()`), endpoints REST parametrizados e isolamento rigoroso de sessões.
* **Segurança e Criptografia**: Todas as senhas de tutores e médicos-veterinários são armazenadas como hash criptográfico **SHA-256 com salt de domínio** (`PetStory#2026$`).
* **Banco de Dados Supabase (PostgreSQL)**: Persistência integral de tutores, pacientes, medalhas, vacinas, cirurgias, prescrições, vermífugos, exames laboratoriais (com laudos anexados em Base64 Data URL) e tokens OTP.

---

## 📱 3. Módulos e Telas da Aplicação

### 🔐 A. Portal de Login & Recuperação de Identidade (`#screen-login`)
* **Aba do Tutor**: Acesso com e-mail e senha cadastrados.
* **Aba do Médico-Veterinário**: Acesso profissional com CRMV/UF ou e-mail profissional e senha autenticada pelo banco de dados.
* **Acesso do Administrador**: Detecção de credenciais master (`admin` / `admin`) redirecionando diretamente para o painel de gestão clínica.
* **Redefinição de Senha Segura**: Modal com desafio de identidade real (verificação por telefone de emergência cadastrado ou Tag PST do pet).

### 🐾 B. Central do Tutor & Carteira Digital (`#screen-tutor`)
* **Gerador de Código OTP**: Gera tokens de 6 dígitos em tempo real, gravando no Supabase com expiração automática de 2 horas.
* **Carteirinha Digital de Vacinação**: Exibição das doses aplicadas e reforços futuros calculados por regra de negócio sanitária, com botão de exportação oficial em PDF.
* **Central de Laudos e Exames**: Visualizador de exames laboratoriais e laudos de imagem anexados.
* **Prescrições Ativas e Lembretes**: Medicamentos em curso com posologia e próximos procedimentos cirúrgicos ou vacinais agendados.

### 🩺 C. Terminal Clínico & Leitor de Tags (`#screen-vet-scan`)
* **Leitor de Câmera Real**: Botão interativo que liga a webcam do notebook ou a câmera traseira do celular com mira laser animada e bip sonoro instantâneo ao detectar a medalha (`PST-XXXX`).
* **Crachá Médico Dinâmico**: Exibe o nome do profissional logado, CRMV, clínica e especialidade.
* **Validação Dupla**: Campo para conferência da Tag do animal e digitação do OTP fornecido pelo tutor.
* **Protocolo de Emergência Vital**: Permite acesso imediato ao histórico em risco de vida, registrando auditoria médica obrigatória.

### 📋 D. Prontuário Médico Unificado (`#screen-prontuario`)
* **Banner de Alertas Críticos**: Restrições anestésicas em destaque pulsante (ex: *Bradicardia por Alfa-2 Agonistas*) e alergias medicamentosas severas (ex: *Choque anafilático por Dipirona*).
* **Abas Clínicas Completas**: Visão Geral & Vitais, Sanitário & Vacinas, Prescrições, Cirurgias, Laudos & Exames e Nova Evolução Clínica.
* **Receituário Digital Oficial em PDF**: Modal interativo para emissão de prescrição com posologias editáveis, gerando PDF oficial com cabeçalho da clínica, dados do pet e assinatura dinâmica do médico de plantão.

### 🛡️ E. Painel do Administrador (`#screen-admin`)
* **Gestão do Corpo Clínico**: Formulário para credenciamento de novos médicos-veterinários (Nome Completo, CRMV, UF, Clínica/Hospital, Especialidade, E-mail e Senha inicial).
* **Criptografia Imediata**: A senha do novo médico é automaticamente processada com hash SHA-256 e gravada no Supabase.
* **Listagem em Tempo Real**: Grid de médicos ativos com badges de credenciamento.

### 🏷️ F. Perfil Público da Coleira (`#screen-public-tag`)
* Página pública exibida a quem escanear o QR Code de um pet na rua (URL: `index.html#public-tag?tag=PST-9921`).
* Botões de ação rápida: **WhatsApp Direto com a Tutora** e **Ligação Telefônica de Emergência**.
* Alerta de cuidados imediatos e conformidade com a LGPD.

---

## ⚡ 4. Como Executar o Servidor no Windows (Passo a Passo)

Siga as instruções abaixo para iniciar o backend Java e abrir o frontend na sua máquina:

### 📋 Pré-requisitos
Certifique-se de ter instalado:
* **Java 21 LTS** ou superior: Execute `java -version` para checar.
* **Apache Maven 3.8+**: Execute `mvn -version` para checar.

---

### Passo 1: Abrir o PowerShell no Diretório do Projeto
1. Pressione as teclas `Win + R`, digite `powershell` e pressione `Enter`.
2. Navegue até a pasta do projeto:
   ```powershell
   cd C:\Users\Administrator\Documents\PetStory
   ```

---

### Passo 2: Executar o Servidor Backend Java
No terminal do PowerShell, execute o comando do Maven:

```powershell
mvn clean compile exec:java
```

> [!TIP]
> Em inicializações seguintes, você pode usar a versão rápida sem recompilar do zero:
> ```powershell
> mvn exec:java
> ```

Quando o servidor iniciar com sucesso, você verá no PowerShell a seguinte tela:

```text
==================================================================
 🐾 PetStory • Backend HTTP Server Ativo (Java 21 LTS)
==================================================================
 Porta de Escuta:       http://localhost:8080
 Health Check:          http://localhost:8080/api/health
 Login Tutor:           http://localhost:8080/api/auth/login-tutor
 Login Veterinário:     http://localhost:8080/api/auth/login-vet
 Redefinição de Senha:  http://localhost:8080/api/auth/redefinir-senha
 Gerador de OTP:        http://localhost:8080/api/otp/gerar
 Validador de OTP:      http://localhost:8080/api/otp/validar
 Prontuário Clínico:    http://localhost:8080/api/pets/{id}/prontuario
 Vacinas:               http://localhost:8080/api/vacinas
 Cirurgias:             http://localhost:8080/api/cirurgias
 Prescrições:           http://localhost:8080/api/prescricoes
 Módulo Admin:          http://localhost:8080/api/admin/veterinarios
 Suporte a CORS:        Habilitado (Origem: 127.0.0.1:5500 / *)
==================================================================
```

---

### Passo 3: Abrir a Interface no Navegador
Com o servidor Java rodando na porta `8080`, abra a aplicação no navegador:
* **Opção Recomendada (Live Server / VS Code)**: Abra em `http://127.0.0.1:5500` ou `http://localhost:5500`.
* **Opção Direta**: Dê um duplo clique no arquivo `index.html` ou abra pelo caminho do arquivo no Google Chrome / Microsoft Edge.

---

## 🧪 5. Testagem Automatizada: O Que É, Como Funciona e Por Quê?

### O que é a Testagem de Software?
A testagem automatizada é a prática de escrever scripts de código que verificam se o próprio software funciona exatamente como o esperado, sem depender de testes manuais lentos e propensos a falhas.

No **PetStory**, utilizamos a biblioteca de testes líder do ecossistema Java: o **JUnit 5 (Jupiter)**.

### Por que a Testagem é Crítica no PetStory?
Em sistemas de saúde animal (*HealthTech*), a confiabilidade do software é vital:
1. **Evitar Erros Médicos**: Um erro no código poderia permitir a aplicação de uma vacina repetida ou deixar de exibir um alerta grave de alergia medicamentosa (como alergia a Dipirona), o que levaria o animal a óbito.
2. **Blindagem de Segurança e LGPD**: Os testes garantem que o código OTP de um cão (ex: Thor) jamais seja aceito para abrir o prontuário de outro cão (ex: Bolinha), mantendo o isolamento estrito entre os tutores.
3. **Criptografia Inviolável**: Os testes asseguram que senhas digitadas incorretamente sejam sempre rejeitadas com status `401 Unauthorized` e que o hash da senha jamais seja exposto nas respostas JSON do backend.
4. **Prevenção de Regressão**: Toda vez que criamos uma funcionalidade nova (como a câmera do scanner ou o painel admin), os testes comprovam que nada do que já existia quebrou.

### Como os Testes Estão Estruturados no Código?

A suíte de testes do projeto é dividida em duas camadas essenciais:

#### 1. Testes de Integração e Servidor HTTP (`PetStoryHttpServerTest.java`)
Localizado em `src/test/java/br/com/petstory/server/PetStoryHttpServerTest.java`:
* Inicia um servidor HTTP real em porta dinâmica efêmera (`8089`).
* Dispara requisições REST reais via `java.net.http.HttpClient` simulando o navegador web.
* **O que ele valida:**
  * Endpoint de Health Check (`/api/health`) respondendo `200 OK`.
  * Login de Tutor com e-mail e senha válidos e bloqueio de senhas incorretas com `401`.
  * Login de Médico-Veterinário autenticado pelo banco Supabase e bloqueio com `401`.
  * Redefinição de senha com validação de desafio de identidade (telefone/Tag do pet).
  * Ciclo de vida completo do OTP: geração pelo tutor, expiração de 2 horas e validação clínica.
  * Carregamento do prontuário completo de pacientes caninos.
  * Cadastro de novas vacinas, cirurgias e prescrições médicas.
  * Validações de campos obrigatórios e listagem do Módulo Administrativo (`/api/admin/veterinarios`).

#### 2. Testes Unitários de Regras de Negócio Sanitárias (`PetStoryServiceTest.java`)
Localizado em `src/test/java/br/com/petstory/service/PetStoryServiceTest.java`:
* Valida a lógica de cálculo do status sanitário das vacinas com base na data atual e na data de reforço:
  * Retorna `"Em Dia"` quando o reforço está a mais de 30 dias.
  * Retorna `"Próximo do Reforço"` quando faltam menos de 30 dias para vencer.
  * Retorna `"Atrasada"` quando a data de reforço já foi ultrapassada.
* Valida regras de geração de OTP de 6 dígitos numéricos e cálculo de expiração temporal.

---

### 🚀 Como Executar a Suíte de Testes no PowerShell

Abra o terminal do PowerShell na pasta do projeto e digite:

```powershell
mvn test
```

O Maven compilará as classes, executará todos os testes automaticamente e exibirá o relatório de sucesso:

```text
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running br.com.petstory.server.PetStoryHttpServerTest
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.8 s
[INFO] Running br.com.petstory.service.PetStoryServiceTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.03 s
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

> **Resultado Garantido**: **27 testes executados, 0 falhas, 0 erros (100% de aprovação)**.

---

## 🔑 6. Contas e Credenciais Pré-configuradas para Demonstração

Para avaliar e navegar por todos os fluxos do sistema, utilize as credenciais abaixo:

| Perfil / Função | Usuário / E-mail / CRMV | Senha | Paciente / Finalidade |
| :--- | :--- | :--- | :--- |
| **🛡️ Administrador do Sistema** | `admin` (ou `admin@petstory.app`) | `admin` (ou `admin123`) | Painel de Gestão e Cadastro de Novos Veterinários |
| **🩺 Médico-Veterinário** | `38412` (SP) ou `ricardo.mendonca@vet.com` | `123456` | Dr. Ricardo Mendonça • Clínico Geral & Cirurgião |
| **🩺 Médica-Veterinária** | `45120` (SP) ou `camila.rocha@vet.com` | `123456` | Dra. Camila Rocha • Dermatologia & Alergologia |
| **🩺 Médico-Veterinário** | `61890` (MG) ou `lucas.sampaio@vet.com` | `neuropet2026` | Dr. Lucas Sampaio • Neurologia Veterinária |
| **🐾 Tutora** | `mariana@email.com` | `senha123` | Paciente: **Thor** (Golden Retriever • Tag `PST-9921`) |
| **🐾 Tutor** | `rafael.teste@example.com` | `123456` | Paciente: **Bolinha** (SRD • Tag `PST-1428`) |
| **🏷️ Tag Pública (Medalha)** | Acesse direto no navegador: | — | `index.html#public-tag?tag=PST-9921` |

---

## ⚖️ 7. Conformidade e Normativas Legais
* **CFMV (Conselho Federal de Medicina Veterinária)**: Registro auditado com identificação obrigatória do número de CRMV e UF em todos os lançamentos médicos e emissões de receitas digitais.
* **LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018)**: Criptografia de ponta a ponta para credenciais, isolamento de acessos via autorizações temporárias OTP de 2 horas e preservação do endereço e telefone do tutor na leitura pública da medalha inteligente.

---
© 2026 **PetStory** • Todos os direitos reservados • *HealthTech & Pet Care*.
