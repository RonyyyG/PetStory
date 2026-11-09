package br.com.petstory.server;

import br.com.petstory.client.SupabaseRestClient;
import br.com.petstory.service.AuthService;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;

/**
 * ============================================================================
 * ENDPOINT ADMINISTRATIVO: AdminVetHandler
 * ============================================================================
 * Gerencia o corpo clínico de médicos-veterinários:
 * - GET  /api/admin/veterinarios -> Lista todos os veterinários cadastrados
 * - POST /api/admin/veterinarios -> Cadastra novo profissional com senha criptografada (SHA-256)
 */
public class AdminVetHandler implements HttpHandler {

    private final SupabaseRestClient supabaseClient;

    public AdminVetHandler(SupabaseRestClient supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        String method = exchange.getRequestMethod().toUpperCase();

        if ("GET".equals(method)) {
            tratarListagem(exchange);
        } else if ("POST".equals(method)) {
            tratarCadastro(exchange);
        } else if ("PATCH".equals(method)) {
            tratarAtualizacaoStatus(exchange);
        } else if ("DELETE".equals(method)) {
            tratarExclusao(exchange);
        } else {
            HttpHelper.enviarErro(exchange, 405, "Método não permitido", "Utilize GET, POST, PATCH ou DELETE para /api/admin/veterinarios");
        }
    }

    private void tratarListagem(HttpExchange exchange) throws IOException {
        try {
            JsonArray lista = supabaseClient.listarVeterinarios();
            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.add("veterinarios", lista);
            HttpHelper.enviarJson(exchange, 200, resp);
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro ao listar veterinários", e.getMessage());
        }
    }

    private void tratarCadastro(HttpExchange exchange) throws IOException {
        try {
            JsonObject body = HttpHelper.lerCorpoJson(exchange);

            String nome = body.has("nome") && !body.get("nome").isJsonNull() ? body.get("nome").getAsString().trim() : null;
            String crmvRaw = body.has("crmv") && !body.get("crmv").isJsonNull() ? body.get("crmv").getAsString().trim() : null;
            String uf = body.has("uf") && !body.get("uf").isJsonNull() ? body.get("uf").getAsString().trim().toUpperCase() : "SP";
            String clinica = body.has("clinica") && !body.get("clinica").isJsonNull() ? body.get("clinica").getAsString().trim() : "Hospital Veterinário PetStory";
            String especialidade = body.has("especialidade") && !body.get("especialidade").isJsonNull() ? body.get("especialidade").getAsString().trim() : "Clínico Geral";
            String email = body.has("email") && !body.get("email").isJsonNull() ? body.get("email").getAsString().trim().toLowerCase() : null;
            String senha = body.has("senha") && !body.get("senha").isJsonNull() ? body.get("senha").getAsString().trim() : null;

            if (nome == null || nome.isEmpty()) {
                throw new IllegalArgumentException("O nome completo do médico-veterinário é obrigatório.");
            }
            if (crmvRaw == null || crmvRaw.isEmpty()) {
                throw new IllegalArgumentException("O CRMV profissional é obrigatório.");
            }
            if (email == null || email.isEmpty()) {
                throw new IllegalArgumentException("O e-mail profissional é obrigatório.");
            }
            if (senha == null || senha.length() < 4) {
                throw new IllegalArgumentException("A senha inicial de acesso deve conter no mínimo 4 caracteres.");
            }

            // Formatação padrão: CRMV-{UF} {NUMERO}
            String crmvFormatado = crmvRaw;
            if (!crmvFormatado.toUpperCase().startsWith("CRMV-")) {
                crmvFormatado = "CRMV-" + uf + " " + crmvRaw;
            }

            // Cálculo do hash SHA-256 com salt de domínio
            String senhaHash = AuthService.gerarHashSenha(senha);

            JsonObject novoVet = new JsonObject();
            novoVet.addProperty("nome", nome);
            novoVet.addProperty("crmv", crmvFormatado);
            novoVet.addProperty("clinica", clinica);
            novoVet.addProperty("especialidade", especialidade);
            novoVet.addProperty("email", email);
            novoVet.addProperty("senha_hash", senhaHash);
            novoVet.addProperty("ativo", true);

            JsonObject salvo = supabaseClient.cadastrarVeterinario(novoVet);

            // Responde sem expor o hash da senha
            JsonObject salvoResposta = salvo.deepCopy();
            salvoResposta.remove("senha_hash");

            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.addProperty("mensagem", "Médico-veterinário cadastrado e credencial ativada com sucesso.");
            resp.add("veterinario", salvoResposta);

            HttpHelper.enviarJson(exchange, 201, resp);

        } catch (IllegalArgumentException e) {
            HttpHelper.enviarErro(exchange, 400, "Dados inválidos", e.getMessage());
        } catch (SecurityException e) {
            HttpHelper.enviarErro(exchange, 401, "Acesso não autorizado", e.getMessage());
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro interno ao cadastrar veterinário", e.getMessage());
        }
    }

    private String extrairId(HttpExchange exchange, JsonObject body) {
        String path = exchange.getRequestURI().getPath();
        if (path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        String[] partes = path.split("/");
        // Partes para /api/admin/veterinarios/{id}: ["", "api", "admin", "veterinarios", "{id}"]
        if (partes.length >= 5 && !partes[4].trim().isEmpty()) {
            return partes[4].trim();
        }

        String query = exchange.getRequestURI().getQuery();
        if (query != null && !query.trim().isEmpty()) {
            for (String param : query.split("&")) {
                if (param.startsWith("id=")) {
                    return param.substring(3).trim();
                }
            }
        }

        if (body != null && body.has("id") && !body.get("id").isJsonNull()) {
            return body.get("id").getAsString().trim();
        }

        return null;
    }

    private void tratarAtualizacaoStatus(HttpExchange exchange) throws IOException {
        try {
            JsonObject body = HttpHelper.lerCorpoJson(exchange);
            String id = extrairId(exchange, body);

            if (id == null || id.isEmpty()) {
                throw new IllegalArgumentException("O ID do médico-veterinário é obrigatório para atualização de status.");
            }

            boolean ativo = true;
            if (body.has("ativo") && !body.get("ativo").isJsonNull()) {
                ativo = body.get("ativo").getAsBoolean();
            }

            boolean sucesso = supabaseClient.atualizarStatusVeterinario(id, ativo);
            if (!sucesso) {
                throw new RuntimeException("Não foi possível atualizar o status do veterinário no banco de dados.");
            }

            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.addProperty("mensagem", ativo 
                    ? "Credencial do médico-veterinário ativada com sucesso." 
                    : "Acesso do médico-veterinário suspenso/desativado.");
            resp.addProperty("id", id);
            resp.addProperty("ativo", ativo);

            HttpHelper.enviarJson(exchange, 200, resp);
        } catch (IllegalArgumentException e) {
            HttpHelper.enviarErro(exchange, 400, "Dados inválidos", e.getMessage());
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro interno ao atualizar status do veterinário", e.getMessage());
        }
    }

    private void tratarExclusao(HttpExchange exchange) throws IOException {
        try {
            JsonObject body = HttpHelper.lerCorpoJson(exchange);
            String id = extrairId(exchange, body);

            if (id == null || id.isEmpty()) {
                throw new IllegalArgumentException("O ID do médico-veterinário é obrigatório para exclusão.");
            }

            boolean sucesso = supabaseClient.excluirVeterinario(id);
            if (!sucesso) {
                throw new RuntimeException("Não foi possível excluir o veterinário no banco de dados.");
            }

            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.addProperty("mensagem", "Médico-veterinário removido com sucesso.");
            resp.addProperty("id", id);

            HttpHelper.enviarJson(exchange, 200, resp);
        } catch (IllegalArgumentException e) {
            HttpHelper.enviarErro(exchange, 400, "Dados inválidos", e.getMessage());
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro interno ao excluir veterinário", e.getMessage());
        }
    }
}
