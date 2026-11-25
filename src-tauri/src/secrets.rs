use std::ptr;

#[cfg(windows)]
use windows_sys::Win32::Foundation::LocalFree;
#[cfg(windows)]
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

#[cfg(windows)]
fn blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
    CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    }
}

#[cfg(windows)]
pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    unsafe {
        let input = blob(data);
        let mut output = CRYPT_INTEGER_BLOB::default();
        let ok = CryptProtectData(
            &input,
            ptr::null(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        );
        if ok == 0 {
            return Err("Не удалось зашифровать данные аккаунта".to_string());
        }
        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as *mut core::ffi::c_void);
        Ok(result)
    }
}

#[cfg(windows)]
pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    unsafe {
        let input = blob(data);
        let mut output = CRYPT_INTEGER_BLOB::default();
        let ok = CryptUnprotectData(
            &input,
            ptr::null_mut(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        );
        if ok == 0 {
            return Err("Не удалось расшифровать данные аккаунта".to_string());
        }
        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as *mut core::ffi::c_void);
        Ok(result)
    }
}

#[cfg(not(windows))]
pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(not(windows))]
pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn dpapi_roundtrip() {
        let data = b"lavunio-secret-token";
        let encrypted = protect(data).expect("protect");
        assert_ne!(encrypted, data);
        let decrypted = unprotect(&encrypted).expect("unprotect");
        assert_eq!(decrypted, data);
    }
}
