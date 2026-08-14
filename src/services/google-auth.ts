export type GoogleProfile = {
  id: string;
  name: string;
  email: string;
  token: string;
  avatar: string | null;
};

export async function signInWithGoogle(): Promise<GoogleProfile | null> {
  try {
    // O Metro do Expo 57 pode gerar "Requiring unknown module" ao usar
    // import() dinâmico com este pacote ESM. O require mantém o módulo
    // nativo resolvido no development build.
    const googleSignIn = require('react-native-nitro-google-signin') as typeof import('react-native-nitro-google-signin');
    const {
      GoogleOneTapSignIn,
      isCancelledResponse,
      isNoSavedCredentialFoundResponse,
      isSuccessResponse,
    } = googleSignIn;

    if (!GoogleOneTapSignIn) {
      throw new Error('O módulo nativo do Google Sign-In não está disponível. Recompile o development build.');
    }

    GoogleOneTapSignIn.configure({
      webClientId:
        '1022110943350-u5fp04sb69d4bg9ndaofsh2pc44hq6ie.apps.googleusercontent.com',
    });

    await GoogleOneTapSignIn.checkPlayServices();
    let response = await GoogleOneTapSignIn.signIn();

    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.createAccount();
    }
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.presentExplicitSignIn();
    }

    if (isCancelledResponse(response) || !isSuccessResponse(response)) {
      return null;
    }

    const user = response.data.user;
    if (!user.id || !user.email) {
      throw new Error('O Google não devolveu o id e o email necessários.');
    }
    const name =
      user.name ||
      [user.givenName, user.familyName].filter(Boolean).join(' ') ||
      user.email.split('@')[0];

    return {
      id: user.id,
      name,
      email: user.email,
      token: response.data.idToken,
      avatar: user.photo ?? null,
    };
  } catch (error) {
    console.error('Erro no Google Login:', error);
    throw error;
  }
}
