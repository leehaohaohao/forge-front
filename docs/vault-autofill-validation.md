# Search and vault autofill isolation

The header search and vault secrets previously had no explicit form ownership. Chrome could interpret the search text field as a username paired with the vault password. `autocomplete=off` alone is not a reliable opt-out for stored login credentials.

- The header has its own search form, search input type, accessible label and stable query name.
- Vault secrets belong to a separate form and use `new-password` to avoid automatic reuse of saved account passwords. Recovery and draft inputs follow the same policy.
- Account reauthentication has a different form owner and retains `current-password`; the login page is unchanged.
- Native submit is prevented so Enter cannot reload the page or serialize secrets into a URL. Inputs remain native masked password fields; typing, paste and keyboard focus are unchanged.

References: https://www.chromium.org/developers/design-documents/form-styles-that-chromium-understands/ and https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion

Validation: TypeScript/Vite production build passed. The production-page regression checks distinct form ownership, autocomplete semantics, empty initial values and Enter retaining the page and input, followed by the existing vault workflows. A timing race in the earlier verification/blur assertion was corrected to wait for asynchronous crypto verification to finish first.

Limit: the test uses an isolated Chrome profile, not the user's saved-password database. It does not prove behavior for every saved credential or extension. User-selected password-manager filling and browser password-generation suggestions are still browser-controlled; no browser settings or stored credentials were modified.
