package com.bankomunal.service;

import com.bankomunal.dto.response.*;
import com.bankomunal.entity.*;
import com.bankomunal.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;

    public List<AccountResponse> getCuentasUsuario(Long userId) {
        return accountRepository.findByOwnerUserIdAndStatus(userId, Account.AccountStatus.active)
                .stream().map(a -> AccountResponse.builder()
                        .id(a.getId())
                        .numero(a.getAccountCode())
                        .tipo(a.getAccountType().name())
                        .saldo(a.getBalance())
                        .currency(a.getCurrency())
                        .status(a.getStatus().name())
                        .build())
                .toList();
    }
}
