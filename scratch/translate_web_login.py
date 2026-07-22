import json
import os

LOCALES_DIR = r"C:\DressApp_AG\frontend\src\locales"

TRANSLATIONS = {
    "en": {
        "webLoginTitle": "Log In to Your {{appName}} Account",
        "webLoginSub": "Authenticate your {{appName}} account to grant DressApp access for database migration.",
        "webLoginEmail": "Email or Username",
        "webLoginPassword": "Password",
        "webLoginBtn": "Sign In to {{appName}}",
        "webLoginSSO": "Or Sign In with Google / Apple",
        "webLoginAuthenticated": "Session Connected: Authenticated with {{appName}}",
        "webLoginProceed": "Proceed to Migration Permission",
        "openExternal": "Open Official Login Page"
    },
    "es": {
        "webLoginTitle": "Iniciar sesión en su cuenta de {{appName}}",
        "webLoginSub": "Autentique su cuenta de {{appName}} para otorgar acceso a DressApp para la migración.",
        "webLoginEmail": "Correo electrónico o usuario",
        "webLoginPassword": "Contraseña",
        "webLoginBtn": "Iniciar sesión en {{appName}}",
        "webLoginSSO": "O iniciar sesión con Google / Apple",
        "webLoginAuthenticated": "Sesión conectada: Autenticado con {{appName}}",
        "webLoginProceed": "Continuar a permisos de migración",
        "openExternal": "Abrir página oficial de inicio de sesión"
    },
    "fr": {
        "webLoginTitle": "Connectez-vous à votre compte {{appName}}",
        "webLoginSub": "Authentifiez votre compte {{appName}} pour autoriser la migration vers DressApp.",
        "webLoginEmail": "E-mail ou nom d'utilisateur",
        "webLoginPassword": "Mot de passe",
        "webLoginBtn": "Se connecter à {{appName}}",
        "webLoginSSO": "Ou se connecter avec Google / Apple",
        "webLoginAuthenticated": "Session connectée : Authentifié avec {{appName}}",
        "webLoginProceed": "Passer à l'autorisation de migration",
        "openExternal": "Ouvrir la page de connexion officielle"
    },
    "de": {
        "webLoginTitle": "Bei Ihrem {{appName}}-Konto anmelden",
        "webLoginSub": "Authentifizieren Sie Ihr {{appName}}-Konto, um DressApp Zugriff für die Datenmigration zu gewähren.",
        "webLoginEmail": "E-Mail oder Benutzername",
        "webLoginPassword": "Passwort",
        "webLoginBtn": "Bei {{appName}} anmelden",
        "webLoginSSO": "Oder mit Google / Apple anmelden",
        "webLoginAuthenticated": "Sitzung verbunden: Authentifiziert bei {{appName}}",
        "webLoginProceed": "Weiter zur Migrationsberechtigung",
        "openExternal": "Offizielle Anmeldeseite öffnen"
    },
    "it": {
        "webLoginTitle": "Accedi al tuo account {{appName}}",
        "webLoginSub": "Autentica il tuo account {{appName}} per concedere a DressApp l'accesso per la migrazione.",
        "webLoginEmail": "E-mail o Nome utente",
        "webLoginPassword": "Password",
        "webLoginBtn": "Accedi a {{appName}}",
        "webLoginSSO": "Oppure accedi con Google / Apple",
        "webLoginAuthenticated": "Sessione connessa: Autenticato con {{appName}}",
        "webLoginProceed": "Procedi all'autorizzazione della migrazione",
        "openExternal": "Apri pagina di accesso ufficiale"
    },
    "pt": {
        "webLoginTitle": "Entrar na sua conta {{appName}}",
        "webLoginSub": "Autentique sua conta {{appName}} para conceder acesso ao DressApp para a migração.",
        "webLoginEmail": "E-mail ou Nome de usuário",
        "webLoginPassword": "Senha",
        "webLoginBtn": "Entrar no {{appName}}",
        "webLoginSSO": "Ou entrar com Google / Apple",
        "webLoginAuthenticated": "Sessão conectada: Autenticado com {{appName}}",
        "webLoginProceed": "Prosseguir para autorização de migração",
        "openExternal": "Abrir página oficial de login"
    },
    "ru": {
        "webLoginTitle": "Войдите в свой аккаунт {{appName}}",
        "webLoginSub": "Подтвердите свой аккаунт {{appName}}, чтобы предоставить DressApp доступ к миграции.",
        "webLoginEmail": "Эл. почта или имя пользователя",
        "webLoginPassword": "Пароль",
        "webLoginBtn": "Войти в {{appName}}",
        "webLoginSSO": "Или войти через Google / Apple",
        "webLoginAuthenticated": "Сеанс подключен: Авторизован в {{appName}}",
        "webLoginProceed": "Перейти к разрешению на миграцию",
        "openExternal": "Открыть официальную страницу входа"
    },
    "zh": {
        "webLoginTitle": "登录您的 {{appName}} 账户",
        "webLoginSub": "验证您的 {{appName}} 账户，以向 DressApp 授予数据库迁移权限。",
        "webLoginEmail": "电子邮件或用户名",
        "webLoginPassword": "密码",
        "webLoginBtn": "登录到 {{appName}}",
        "webLoginSSO": "或使用 Google / Apple 登录",
        "webLoginAuthenticated": "会话已连接：已通过 {{appName}} 身份验证",
        "webLoginProceed": "继续进行迁移授权",
        "openExternal": "打开官方登录页面"
    },
    "ja": {
        "webLoginTitle": "{{appName}} アカウントにログイン",
        "webLoginSub": "DressAppにデータベース移行アクセス許可を与えるため、{{appName}} アカウントを認証してください。",
        "webLoginEmail": "メールアドレスまたはユーザー名",
        "webLoginPassword": "パスワード",
        "webLoginBtn": "{{appName}} にログイン",
        "webLoginSSO": "または Google / Apple でサインイン",
        "webLoginAuthenticated": "セッション接続済み: {{appName}} で認証完了",
        "webLoginProceed": "移行の権限確認に進む",
        "openExternal": "公式ログインページを開く"
    },
    "ar": {
        "webLoginTitle": "تسجيل الدخول إلى حسابك في {{appName}}",
        "webLoginSub": "قم بتوثيق حسابك في {{appName}} لمنح DressApp صلاحية الوصول لنقل بيانات خزانة ملابسك.",
        "webLoginEmail": "البريد الإلكتروني أو اسم المستخدم",
        "webLoginPassword": "كلمة المرور",
        "webLoginBtn": "تسجيل الدخول إلى {{appName}}",
        "webLoginSSO": "أو تسجيل الدخول عبر Google / Apple",
        "webLoginAuthenticated": "تم الاتصال بالجلسة: تم التوثيق بنجاح مع {{appName}}",
        "webLoginProceed": "المتابعة لإذن نقل البيانات",
        "openExternal": "فتح صفحة تسجيل الدخول الرسمية"
    },
    "hi": {
        "webLoginTitle": "अपने {{appName}} खाते में लॉगिन करें",
        "webLoginSub": "डेटा माइग्रेशन के लिए DressApp को अनुमति देने हेतु अपना {{appName}} खाता प्रमाणित करें।",
        "webLoginEmail": "ईमेल या उपयोगकर्ता नाम",
        "webLoginPassword": "पासवर्ड",
        "webLoginBtn": "{{appName}} में लॉगिन करें",
        "webLoginSSO": "या Google / Apple के साथ साइन इन करें",
        "webLoginAuthenticated": "सत्र कनेक्टेड: {{appName}} के साथ प्रमाणित",
        "webLoginProceed": "माइग्रेशन अनुमति पर आगे बढ़ें",
        "openExternal": "आधिकारिक लॉगिन पृष्ठ खोलें"
    },
    "he": {
        "webLoginTitle": "התחברות לחשבון {{appName}} שלך",
        "webLoginSub": "אימות חשבון ה-{{appName}} שלך כדי להעניק ל-DressApp הרשאת גישה להעברת המלתחה.",
        "webLoginEmail": "אימייל או שם משתמש",
        "webLoginPassword": "סיסמה",
        "webLoginBtn": "התחברות ל-{{appName}}",
        "webLoginSSO": "או התחברות באמצעות Google / Apple",
        "webLoginAuthenticated": "הפעלת התחברות הושלמה: מאומת מול {{appName}}",
        "webLoginProceed": "המשך לאישור העברת הנתונים",
        "openExternal": "פתיחת דף ההתחברות הרשמי"
    },
    "nl": {
        "webLoginTitle": "Inloggen op uw {{appName}}-account",
        "webLoginSub": "Authenticeer uw {{appName}}-account om DressApp toegang te verlenen voor gegevensmigratie.",
        "webLoginEmail": "E-mailadres of gebruikersnaam",
        "webLoginPassword": "Wachtwoord",
        "webLoginBtn": "Inloggen bij {{appName}}",
        "webLoginSSO": "Of inloggen met Google / Apple",
        "webLoginAuthenticated": "Sessie verbonden: Geauthenticeerd met {{appName}}",
        "webLoginProceed": "Doorgaan naar migratiemachtiging",
        "openExternal": "Officiële inlogpagina openen"
    }
}

def main():
    for lang, keys in TRANSLATIONS.items():
        filepath = os.path.join(LOCALES_DIR, f"{lang}.json")
        if not os.path.exists(filepath):
            continue
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "migration" not in data:
            data["migration"] = {}
        for k, v in keys.items():
            data["migration"][k] = v
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"Updated {lang}.json with webLogin keys")

if __name__ == "__main__":
    main()
