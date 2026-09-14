# Liquidación conservadora · versión 1

src/rules.js aplica settle; src/provider.js verifica identidad y resultado; Store.refresh guarda respuesta, resultado y auditoría en una transacción.

Reglas consultadas el 14/09/2026:
- https://help.bet365.com/s/en/sportsrules/soccer/result-event-half-time (redirigió a ayuda australiana): resultado de 90 minutos más descuento, sin prórroga ni penaltis; ganador y doble oportunidad.
- https://help.bet365.com/s/en-ca/sportsrules/soccer/goal-line : goles con líneas enteras (igualdad = devolución) y medias líneas.

Son referencias públicas de Bet365 de distintas jurisdicciones. Antes de emitir una recomendación, comprobar que las condiciones del mercado concreto coinciden y guardar ruleId únicamente si coinciden. Sin ruleId reconocido no se liquida. No se afirma haber verificado condiciones específicas de la cuenta española.

Soportados automáticamente: winner (1/X/2), double_chance (1X/X2/12), goals (over/under, entero o medio), periodo 90m, Bet365, regla explícita.

Tarjetas y córners se registran y sus estadísticas se conservan, pero permanecen pendientes: no se ha verificado la equivalencia del cómputo de ESPN con las reglas concretas de estos mercados. No se suman amarillas y rojas ni se usa el marcador para liquidarlos. Tampoco se liquidan cuartos de línea, primera parte, prórroga, abandonos o suspensiones. Una suspensión no implica automáticamente apuesta nula.

ESPN debe devolver STATUS_FULL_TIME, completed=true y periodo 2 o exactamente dos parciales por equipo. STATUS_FINAL_AET, penaltis y marcadores sin prueba de periodo quedan pendientes. Se consultan IDs de evento y equipos, nunca se enlaza por similitud de nombre. Un cambio de fecha mantiene el mismo evento; si ESPN sustituye su ID se necesita revisión y nuevo registro con nota de relación, sin unión automática.

Cada revisión de resultados conserva la respuesta íntegra local y crea auditoría solo si cambia la liquidación. Un error de red o identidad no altera el encuentro. Se revisan también los resueltos para detectar correcciones de la fuente. Las notas de corrección son aditivas y no cambian el pronóstico original ni fuerzan una liquidación.
