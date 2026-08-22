import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override List<Object?> get props => [];
}

class AuthStarted extends AuthEvent { const AuthStarted(); }

class AuthLoginRequested extends AuthEvent {
  final String email;
  final String password;
  const AuthLoginRequested(this.email, this.password);
  @override List<Object?> get props => [email];
}

class AuthLogoutRequested extends AuthEvent { const AuthLogoutRequested(); }
