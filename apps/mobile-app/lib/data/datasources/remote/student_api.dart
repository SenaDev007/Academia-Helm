import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:academia_helm_mobile/data/dto/student_dto.dart';

part 'student_api.g.dart';

@RestApi(baseUrl: '/students')
abstract class StudentApi {
  factory StudentApi(Dio dio, {String? baseUrl}) = _StudentApi;

  @GET('')
  Future<StudentListResponse> getStudents(
    @Query('classId') String? classId,
    @Query('levelId') String? levelId,
    @Query('search') String? search,
    @Query('page') int page,
    @Query('limit') int limit,
  );

  @GET('/{id}')
  Future<StudentDto> getStudentById(@Path('id') String id);

  @POST('')
  Future<StudentDto> createStudent(@Body() CreateStudentRequest request);

  @PATCH('/{id}')
  Future<StudentDto> updateStudent(
    @Path('id') String id,
    @Body() UpdateStudentRequest request,
  );
}
