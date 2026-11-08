package br.com.petstory.server;

import br.com.petstory.service.AuthService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;

/**
 * Endpoint: POST /api/auth/redefinir-senha
 * Recebe { "email": "...", "desafioIdentidade": "...", "novaSenha": "..." }
 * Valida o desafio de identidade contra os dados reais do tutor/pet e atualiza a senha_hash.
 */
public class RedefinirSenhaHandler implements HttpHandler {

    private final AuthService authService;

    public RedefinirSenhaHandler(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            HttpHelper.enviarErro(exchange, 405, "Método não permitido", "Utilize POST para /api/auth/redefinir-senha");
            return;
        }

        try {
            JsonObject body = HttpHelper.lerCorpoJson(exchange);
            String email = body.has("email") ? body.get("email").getAsString() : null;
            String desafioIdentidade = body.has("desafioIdentidade") ? body.get("desafioIdentidade").getAsString() : null;
            String novaSenha = body.has("novaSenha") ? body.get("novaSenha").getAsString() : null;

            JsonObject resultado = authService.redefinirSenha(email, desafioIdentidade, novaSenha);
            HttpHelper.enviarJson(exchange, 200, resultado);
        } catch (IllegalArgumentException e) {
            int code = e.getMessage().contains("não localizado") ? 404 : 400;
            HttpHelper.enviarErro(exchange, code, "Dados inválidos", e.getMessage());
        } catch (SecurityException e) {
            HttpHelper.enviarErro(exchange, 401, "Confirmação de identidade recusada", e.getMessage());
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro interno do servidor", e.getMessage());
        }
    }
}
