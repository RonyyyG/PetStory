package br.com.petstory.server;

import br.com.petstory.service.AuthService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;

/**
 * Endpoint: POST /api/auth/login-tutor
 */
public class AuthTutorHandler implements HttpHandler {

    private final AuthService authService;

    public AuthTutorHandler(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            HttpHelper.enviarErro(exchange, 405, "Método não permitido", "Utilize POST para /api/auth/login-tutor");
            return;
        }

        try {
            JsonObject body = HttpHelper.lerCorpoJson(exchange);
            String email = body.has("email") ? body.get("email").getAsString() : null;
            String senha = body.has("senha") ? body.get("senha").getAsString() : null;

            JsonObject resultado = authService.autenticarTutor(email, senha);
            HttpHelper.enviarJson(exchange, 200, resultado);
        } catch (IllegalArgumentException e) {
            HttpHelper.enviarErro(exchange, 400, "Dados incompletos", e.getMessage());
        } catch (SecurityException e) {
            HttpHelper.enviarErro(exchange, 401, "Autenticação recusada", e.getMessage());
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro interno do servidor", e.getMessage());
        }
    }
}
