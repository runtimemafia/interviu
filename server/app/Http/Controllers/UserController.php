<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Str;
use Nette\Utils\Random;

class UserController extends Controller
{

    public function register_with_google(Request $request)
    {
        $googleUser = Socialite::driver("google")->user();
        $user = User::updateOrCreate(
            ["google_id" => $googleUser->id],
            [
                "name" => $googleUser->name,
                "email" => $googleUser->email,
                "password" => Hash::make(Str::password(12)),
                'email_verified_at' => now(),
                'avatar' => $googleUser->avatar,
                'remember_token' => UserController::GenerateRememberToken()
            ]
        );
    }

    public static function GenerateRememberToken()
    {
        $token = Random::generate(100, '0-9a-zA-Z');
        $tokenAlreadyExistts = User::where("remember_token", $token)->exists();
        if ($tokenAlreadyExistts) {
            return UserController::GenerateRememberToken();
        } else {
            return $token;
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreUserRequest $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(User $user)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(User $user)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateUserRequest $request, User $user)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(User $user)
    {
        //
    }
}
