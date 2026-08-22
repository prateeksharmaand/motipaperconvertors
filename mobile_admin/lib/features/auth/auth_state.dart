import 'package:equatable/equatable.dart';
import '../../models/auth_models.dart';

abstract class AuthState extends Equatable {
  const AuthState();
  @override List<Object?> get props => [];
}

class AuthInitial extends AuthState { const AuthInitial(); }
class AuthLoading extends AuthState { const AuthLoading(); }

class AuthAuthenticated extends AuthState {
  final MeResponse user;
  const AuthAuthenticated(this.user);
  @override List<Object?> get props => [user.id];
}

class AuthUnauthenticated extends AuthState {
  final String? error;
  const AuthUnauthenticated({this.error});
  @override List<Object?> get props => [error];
}
